# 2026-11-22 — Ingreso rápido y negocio principal

Dos pedidos de UX sobre el arranque de la app, hechos en tres fases: negocio principal,
ingreso rápido con la autenticación del celular y documentación.

## Fase 1 — Negocio principal

### Qué se encontró

Tras iniciar sesión la app abría siempre en el **último negocio creado**. La causa:
`GET /business` responde por `createdAt desc` (`buildOrder` del backend), el cierre de
sesión borra `active_business_id`, y `BusinessProvider` caía a `items[0]`. Peor aún: si a
alguien lo metían como cajero en un negocio más nuevo que el suyo, entraba directo en el
ajeno.

### Qué se cambió

- El usuario marca su negocio **principal** con una estrella en "Mis negocios" (solo con
  dos negocios o más). El selector del inicio lo señala con una estrella; desde ahí no se
  cambia, porque la explicación vive en la lista.
- Orden de arranque en `BusinessProvider`: principal → último usado (si la sesión venía de
  antes) → `defaultBusiness()`, el más antiguo del que es dueño. `Business` ganó
  `createdAt` para eso; si falta (caché vieja), se toma la lista del backend al revés.
- El principal manda solo **al arrancar**. Deja de mandar en cuanto el servidor responde la
  primera vez o el usuario elige un negocio a mano: con el backend gratuito despertando
  (~50 s), una respuesta tardía no debe devolverlo al principal sin que lo pida.

### Qué se decidió

- **Se guarda en el dispositivo, no en el backend**, por usuario (`favorite_businesses`).
  El backend no tiene el campo y la preferencia funciona igual en local. El costo: no viaja
  a otro celular. Si importa, se mueve al backend sin tocar pantallas, porque todas pasan
  por `BusinessProvider`.
- "Siempre" incluye volver a abrir la app, no solo el login: es lo que se pidió. Sin
  principal, al reabrir se conserva el último usado, como antes.

## Fase 2 — Ingreso rápido

### Qué se cambió

- Casilla **opcional** "Recordar mis datos en este celular" en el login. Con ella, la
  próxima vez el login muestra "Hola de nuevo, Ana" y un botón "Entrar con tu huella"
  (Face ID / Touch ID / rostro / bloqueo del celular, según el teléfono). Al abrir la app
  sin sesión, el aviso del sistema sale solo, una vez.
- Perfil → "Entrar sin contraseña": muestra si está activo para esa cuenta y permite
  apagarlo. El mensaje de cerrar sesión dice que bastará la huella.
- Cambiar la contraseña actualiza la recordada; desactivar o eliminar la cuenta la borra.
- Dependencias nuevas con `npx expo install`: `expo-local-authentication` 17.0.9 y
  `expo-secure-store` 15.0.8. El trío congelado no se movió (el diff de `package-lock.json`
  solo agrega esos dos). **Hace falta un build nuevo**: son módulos nativos.

### Qué se decidió y por qué

- **Contraseña en `SecureStore`, nunca en AsyncStorage.** Keychain con
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no sale del iPhone ni a iCloud) y Keystore en Android,
  excluido del respaldo automático por el plugin.
- **Se guarda la contraseña y no un token.** El logout invalida el refresh token en el
  servidor, y esto sirve justo para después del logout. Repetir el login normal es lo único
  que no depende de un token ya borrado.
- **La autenticación del celular se pide en JS** (`authenticateAsync`), no con
  `requireAuthentication` de `SecureStore`. Así se acepta el PIN o patrón como respaldo
  —muchos celulares de gama baja no tienen lector de huella, y lo pedido fue "la
  autenticación del celular"—, funciona igual en las dos plataformas y no se rompe cuando
  la persona registra una huella nueva (que en Android invalida las llaves con
  `requireAuthentication`). El costo: en un teléfono rooteado la puerta es la app y no el
  sistema. Los datos siguen cifrados en reposo.
- **Marca en AsyncStorage.** El llavero de iOS sobrevive a la desinstalación; sin la marca,
  alguien que reinstala encontraría la cuenta recordada.
- **No se activa desde el perfil.** Haría falta comprobar la contraseña, y la única forma es
  un login encima de la sesión viva: el backend borra la sesión del dispositivo y emite
  otra, y una renovación en vuelo con el refresh token viejo se leería como robo. Se activa
  en el login, donde la contraseña ya se está comprobando.
- **Se guarda antes de cambiar el estado de la sesión**, dentro de `login()`: en cuanto el
  estado pasa a `authenticated`, el layout de `(auth)` saca al usuario del login.
- **Desactivar y eliminar la borran en cuanto el backend confirma**, no en el `onConfirm`
  del diálogo: si la persona cerraba el diálogo tocando fuera, la contraseña sobrevivía.
- **Límite dicho en pantalla**: quien pueda desbloquear el celular puede entrar con la
  cuenta recordada (el celular de la tienda lo comparten dueño y cajero).

## Qué se verificó

- `npm run typecheck` y `npm run lint` en 0.
- `npx expo config --type introspect`: `NSFaceIDUsageDescription` en español, permisos
  `USE_BIOMETRIC` y `USE_FINGERPRINT` en Android y reglas de respaldo de `SecureStore` en el
  manifiesto.
- `npx expo export --platform android --platform ios`: los dos bundles compilan.
- `npx expo-doctor`: 16/18, los mismos dos avisos conocidos de la Fase 0.1 de `CLAUDE.md`.
  Las dos librerías nuevas no agregan ninguno.

## Qué NO se verificó

- **Nada se probó en un dispositivo.** Ni Android ni iPhone: no había emulador ni teléfono
  en esta sesión. Falta probar, como mínimo:
  - Android con huella, Android solo con PIN, iPhone con Face ID (build de EAS, no Expo Go);
  - cancelar el aviso, fallar varias veces (bloqueo temporal), quitar el bloqueo del
    celular con datos recordados;
  - cambiar la contraseña en otro teléfono y volver a entrar con la huella (debe pedir la
    contraseña y volver a recordarla);
  - dos negocios: marcar principal, cerrar sesión, entrar → abre en el principal; cambiar
    a otro, cerrar la app y abrirla → abre en el principal.
- El backend no cambió.

## Pendientes

- Llevar el negocio principal al backend si se quiere que viaje entre dispositivos.
- Bloqueo de la app con la huella al abrirla con sesión viva: no se pidió; hoy la sesión
  restaurada entra directo, como antes.
- Visto de paso, sin tocar: en "Mis negocios", tocar la tarjeta de un negocio que no es el
  activo abre los clientes **del activo** (`router.push(routes.tabs.clients)` sin
  seleccionar ni pasar `businessId`).
