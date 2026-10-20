# 2026-10-19 · Endurecimiento de la autenticación

El backend cambió el contrato de autenticación (rama `fix/auth-hardening`) y la app se
adaptó. El documento de origen es _«FIAO · Cambios del módulo de autenticación (backend)»_,
fechado el 18 de octubre de 2026.

Rama de este trabajo: `feature/auth-hardening`, salida de `dev`.

---

## Qué cambió del lado del servidor

Ocho cambios, de los que seis obligan a tocar la app:

1. **El refresh token rota.** Cada renovación devuelve uno nuevo y mata el anterior. Si el
   servidor ve el viejo otra vez, lo lee como un robo y **cierra la sesión**.
2. **Sesión por dispositivo.** El login exige `deviceId` (8–128 caracteres) y acepta
   `deviceName`. Reemplazan al antiguo `deviceInfo`, que ahora responde 400.
3. **Límite de intentos de login:** 5 por minuto por cuenta e IP; al pasarse, 429.
4. **Logout con `allDevices`** cierra todas las sesiones, y con un token inválido ya no
   perdona: responde 401.
5. **Cambio de contraseña en su propio endpoint** (`PATCH /users/me/password`), pidiendo la
   actual, y cerrando todas las sesiones al terminar.
6. **El perfil solo admite nombre y apellido.** Correo, teléfono, documento y rol los
   reserva al administrador: enviarlos da 403.

Los otros dos —el `AuthLog` de seguridad y el guardado de los refresh tokens con SHA-256—
no piden nada de la app. El quinto punto del documento («el access token ya no incluye
`documentNumber`») tampoco: esta app **nunca** decodificó el JWT, el `documentNumber` lo
toma del objeto `user` de la respuesta.

---

## Qué se hizo en la app, y por qué así

### La identidad del dispositivo es un módulo propio

`src/core/device/deviceIdentity.ts`. Un UUID v4 (`expo-crypto`) generado la primera vez y
guardado en la llave `device_id`.

Tres decisiones que conviene no deshacer:

- **No se borra al cerrar sesión.** Identifica el aparato, no a la persona. Regenerarlo en
  cada salida le dejaría al backend una sesión huérfana por cada login.
- **Se cachea en memoria.** El interceptor de axios necesita el valor de forma síncrona para
  armar el header `x-device-id` del refresh. Se hidrata al arrancar, junto a los tokens, en
  el `SessionProvider`.
- **El `deviceName` se arma con marca, modelo y sistema operativo** (`expo-device`), nunca
  con el nombre que el usuario le puso al teléfono: ese suele llevar su nombre real y aquí
  no hace falta.

### La renovación se adelanta al 401

Este es el cambio con más fondo. Antes bastaba con renovar cuando llegaba un 401; ahora, si
dos peticiones renuevan con el mismo token, **el backend cierra la sesión por seguridad**.
El single-flight que ya existía evita el caso simultáneo, pero no el secuencial: dos
peticiones que salen con un token recién vencido chocan una detrás de otra.

Por eso `tokenStore` ahora recuerda cuándo vence el access token (a partir del
`accessTokenExpiresIn` que mandan login y refresh) y el interceptor de petición renueva
cuando le queda menos de un minuto. El vencimiento **no se persiste**: al reabrir la app no
se sabe, y ahí el camino reactivo de siempre sigue siendo el correcto.

Se añadió además un atajo en el interceptor de respuesta: si llega un 401 de una petición
que salió con un token que ya quedó atrás —porque otra la adelantó y renovó—, se reintenta
con el vigente en vez de gastar otra rotación.

### Un fallo de red al renovar ya no cierra la sesión

Antes, **cualquier** error del refresh terminaba en `clearTokens()` + vuelta al login. Con
el backend durmiendo en el plan gratuito de Render, eso significaba echar al usuario por un
arranque en frío. Ahora solo un **401** cierra la sesión; un `NETWORK`, un `TIMEOUT` o un
502 se propagan y la pantalla ofrece reintentar con lo que tenga en caché.

Cuando sí hay que salir, el mensaje que se muestra es el del backend —«La sesión se cerró
por seguridad. Inicia sesión de nuevo.»— y no un texto nuestro, porque explica algo que el
usuario necesita saber.

### El login deja hablar al backend

El 401 del login dejó de ser siempre «contraseña mala»: también responde así cuando el dato
escrito pertenece a dos cuentas, y entonces dice qué hacer. La pantalla ahora solo cambia el
**título** (el genérico «Sesión no válida» despista en un login) y respeta el mensaje del
servidor; el texto propio queda de reserva para cuando no venga ninguno.

El 429 entra como código de error nuevo, `RATE_LIMITED`, con su copia en español y en tono
ámbar —no es un fallo, es «espera un minuto»—. No se reintenta solo.

De paso, el campo pasó a llamarse «Correo, celular o documento»: el backend acepta los tres
desde antes, pero la app solo nombraba dos.

### Contraseña y perfil

- **Seguridad** pide ahora la contraseña actual y, al terminar, avisa con un diálogo de que
  se cerró la sesión en todos los dispositivos y sale al login. No navega a mano: al
  quedarse sin sesión, la guardia de `app/(app)/_layout.tsx` hace el resto.
- **Editar perfil** muestra correo, celular y documento como datos de solo lectura, en una
  tarjeta con la vía para corregirlos. Un input que siempre va a fallar al guardar es peor
  que no mostrarlo.
- **Perfil** gana «Cerrar sesión en todos los dispositivos», que es la contrapartida visible
  de la sesión por aparato: sin ella, `allDevices` sería código muerto.

---

## Decisiones que se tomaron y conviene revisar

### Los tokens siguen en AsyncStorage, no en `expo-secure-store`

El documento del backend recomienda almacenamiento seguro (Keychain/Keystore) para el
refresh token. **No se hizo**, por dos razones: el contrato de llaves de AsyncStorage está
documentado en `CLAUDE.md` y es compatible con el v1, y migrarlo es un cambio de
almacenamiento con su propia ruta de migración —no parte de este contrato—. Queda como
pendiente real, no como olvido: un refresh token en AsyncStorage es legible en un
dispositivo con root.

El `deviceId` se guardó en el mismo sitio y eso sí es correcto: no es un secreto.

### Dos dependencias nuevas

`expo-crypto` (UUID v4) y `expo-device` (marca, modelo, sistema operativo), instaladas con
`npx expo install`, que es la vía que exige la Fase 0 de `CLAUDE.md`. Las dos vienen dentro
de Expo Go, así que no obligan a un build nativo para seguir probando. El trío congelado
(`expo 54.0.1`, `react 19.1.0`, `react-native 0.81.4`) quedó intacto.

La alternativa era generar el UUID con `Math.random()` y armar el nombre con `Platform`.
Habría funcionado, pero el identificador que ata la sesión a un aparato merece un generador
criptográfico, y el nombre sin modelo no le sirve a la futura pantalla de sesiones activas.

### Compatibilidad hacia atrás, a propósito

Si el backend no devuelve `refreshToken` en la renovación —una versión anterior a la
rotación— la app conserva el que tenía en vez de quedarse sin sesión. Con el backend nuevo
esa rama no se ejecuta nunca. Está ahí para que la app no se rompa si se despliega antes
que el servidor, aunque el documento pida desplegarlos juntos.

---

## Qué se verificó y qué no

**Verificado:**

- `npm run typecheck` — 0 errores.
- `npm run lint` — 0 problemas.
- `npx expo export --platform android --platform ios` — los dos bundles compilan.

**No verificado:** nada de esto se probó contra el backend, porque la rama
`fix/auth-hardening` todavía no está desplegada en ningún entorno alcanzable desde la app.
En concreto, falta comprobar con el servidor delante:

- que el login con `deviceId` responde 201 y que entrar en un segundo dispositivo no cierra
  la sesión del primero;
- la rotación: que tras un refresh el token viejo ya no sirve y que la app guardó el nuevo;
- el 429 tras cinco intentos fallidos en un minuto;
- el cambio de contraseña, incluido el 400 cuando la actual no coincide;
- el 403 del perfil si se colara algún campo restringido;
- la renovación anticipada con la app abierta más de quince minutos.

Tampoco se probó en dispositivo: no se ejecutó en Android ni en iPhone. El cambio no toca
insets, teclado, sombras ni gestos, pero `expo-device` y `expo-crypto` son módulos nativos y
conviene abrir la app en los dos sistemas antes de dar esto por cerrado.

---

## Pendiente del backend

El documento anuncia un segundo entregable: los **documentos legales** (términos y política
de datos), que agregan campos al registro y a la respuesta del login y del refresh. La app
ya tiene la casilla de aceptación y la pantalla de lectura desde
[2026-10-14](2026-10-14-terminos-y-condiciones.md), pero **sigue sin enviar la aceptación**
a ningún sitio. Ese pendiente se cierra con ese documento, no con este.
