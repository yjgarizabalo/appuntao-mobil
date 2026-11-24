# CLAUDE.m

**Appuntao** (antes «Fiao») — app móvil (Android + iPhone) para que tenderos lleven el
control de los **vales / fiado**: clientes que compran a crédito, deudas que se acumulan y
pagos que abonan ese saldo. Repositorio: `github.com/yjgarizabalo/appuntao-mobil`.

> **Identificadores.** `slug` y `scheme` son `appuntao` y el package/bundle es
> `com.yair77.appuntao` (antes `com.yair77.fiao`: es **otra app** para las tiendas, con su
> propio keystore y su propio proyecto en EAS). Siguen con «fiao» **a propósito** las llaves
> de AsyncStorage (incluido el prefijo `fiao_cache:`) y la URL del backend (`fiao-backend`):
> la URL es la del servidor desplegado. No las renombres sin autorización explícita.

mismas funcionalidades, pero con arquitectura por capas, design system propio y las versiones
de React/Expo congeladas. El detalle de qué cambió y por qué está en
`claude/migraciones/v1-a-v2-arquitectura.md`.

> **Dónde va cada documento.** Este archivo son las **reglas**: lo que hay que cumplir en
> cada cambio. El **porqué** —migraciones, refactorizaciones, despliegue y la bitácora de
> cada sesión— vive en la carpeta [`claude/`](claude/README.md), con su propio índice.
> Un documento nuevo de contexto va ahí, no suelto en la raíz.

> **Documento organizado en fases.** Léelas en orden la primera vez; después ve a la que
> corresponda. Las **Fases 0 y 8** son de cumplimiento obligatorio en todo cambio.

---

## FASE 0 — Reglas no negociables

### 0.1 Las versiones están CONGELADAS 🔒

El trío que define la compatibilidad de dispositivos está **fijado a versión exacta**, igual
que en el v1, y declarado como intencional en `package.json > expo.install.exclude`:

```
expo          54.0.1
react         19.1.0
react-native  0.81.4
```

`npx expo-doctor` reporta hoy **16/18**. Los dos checks que fallan son avisos conocidos que
**no** rompen el build ni EAS:

1. «packages match versions required by installed Expo SDK», por deriva de parche en
   `expo-router`, `expo-splash-screen` y `expo-status-bar` (el registro avanzó, el proyecto
   no). Subirlos exige autorización y volver a probar en las dos plataformas.
2. «required peer dependencies are installed»: falta `react-dom`, que pide
   `react-native-web`. Solo afecta al target **web**, que es secundario (Fase 0.2).
   `react-dom` está fijado en `overrides` y listado en `expo.install.exclude`, pero no
   declarado en `dependencies`; instalarlo toca el trío congelado y requiere autorización.

Está **prohibido** sin autorización explícita:

- `npm update`, `npx expo install --fix`, `npm audit fix`, bumps a mano en `package.json`.
- Subir el SDK de Expo o cualquier `expo-*` de forma individual.
- Quitar el bloque `overrides` que fija `react` / `react-dom` en `19.1.0`.
- Quitar `expo.install.exclude`: es lo que le dice a Expo que los pines son deliberados.
- Editar `package-lock.json` a mano.

Para instalar algo nuevo se usa **siempre** `npx expo install <paquete>`, que resuelve la
versión compatible con SDK 54, nunca `npm install <paquete>@latest`.

### 0.2 Android e iPhone son el objetivo

Todo cambio debe funcionar en las dos plataformas. Web existe en la configuración pero es
secundario. Ver **Fase 8**.

### 0.3 Idioma y moneda

- UI **en español** (Colombia). Moneda **COP**, locale `es-CO`.
- Código en inglés (variables, funciones, tipos); comentarios y textos de usuario en español.
- Todo el dinero se formatea con `formatMoney()`; ninguna pantalla llama a `Intl` directamente.

### 0.4 Sin hex, sin números mágicos

Ningún componente escribe un color, un padding, un radio o un tamaño de letra literal.
Todo sale de `@/theme`. Si falta un token, se agrega al tema, no a la pantalla.

---

## FASE 1 — Dominio

```
User (tendero)
 └── Business (negocio)              ← un usuario puede tener varios
      └── Debtor (cliente que fía)   ← en el API es "debtor", en la UI "cliente"
           └── Debt (deuda / vale)
                └── Payment (pago / abono)
```

Todo vive en `src/domain/`:

| Archivo        | Contenido                                                                               |
| -------------- | --------------------------------------------------------------------------------------- |
| `constants.ts` | `DocumentType`, `PaymentMethod`, `DebtStatus`, `TransactionType` + etiquetas en español |
| `models.ts`    | Entidades (`User`, `Business`, `Debtor`, `Debt`, `Payment`) y funciones de dominio      |
| `mappers.ts`   | Traducción de las respuestas del backend a los modelos                                  |
| `legal.ts`     | Documentos legales del backend (tipos abiertos: los define su catálogo), públicos, contacto y el intérprete de su Markdown |

Funciones de dominio que hay que usar en vez de recalcular en la pantalla:

- `displayName(user)` — nombre a mostrar con degradación si faltan campos.
- `debtorBalance(debtor)` — saldo del negocio, con el consolidado como respaldo.
- `summarizeDebts(debts, serverBalance)` — total fiado, total pagado, saldo, deudas
  abiertas/pagadas y la vencida más antigua. Prioriza el saldo del servidor.
- `buildMovements(debts)` — extracto unificado de deudas + pagos ordenado por fecha.
- `summarizeStandings(standings)` — consolidado del **modo cliente**: cuánto debe el
  usuario sumando todas las tiendas donde le fían.
- `buildClientMovements(standings)` — extracto del cliente cruzando varias tiendas; cada
  fila sabe de qué tienda viene.

**Multi-tenant:** clientes, deudas y pagos pertenecen a un negocio y viajan con el header
`x-business-id`. Nunca lo pongas a mano: usa `businessHeader(businessId)` de
`@/core/http/client`.

**Dos formas de pagar** (las dos se conservan del v1):

1. `POST /payments` — abono a **una** deuda concreta (`paymentApi.create`).
2. `POST /payments/global` — abono al **saldo total**; el backend reparte entre las deudas
   abiertas y devuelve `group.totalAmount` (`paymentApi.createGlobal`). **Es la que usa la
   pantalla de detalle**, igual que en el v1.

---

## FASE 2 — Arquitectura y estructura

Tres capas, con dependencias en una sola dirección: `app/` → `features/` → `domain/` → `core/`.
Nunca al revés (una feature no importa de otra feature; comparten a través de `domain` o `ui`).

```
appuntao-mobil-v2/
├── app/                      # SOLO declaraciones de ruta (expo-router)
├── src/
│   ├── core/                 # infraestructura, sin nada de negocio
│   │   ├── config/env.ts     # variables de entorno validadas
│   │   ├── device/           # identidad de la instalación y autenticación del dueño (deviceAuth)
│   │   ├── errors/           # AppError: un solo modelo de error
│   │   ├── http/             # cliente axios, refresh, normalización de payloads
│   │   ├── hooks/            # useForm, useAsyncData, usePagedList, useDebouncedValue
│   │   ├── navigation/       # routes.ts — todas las rutas en un sitio
│   │   ├── storage/          # AsyncStorage tipado + SecureStore para secretos
│   │   ├── logger/           # logs con niveles y redacción de tokens
│   │   ├── connectivity.ts   # estado de la red (expo-network)
│   │   ├── haptics.ts
│   │   └── utils/            # format.ts, validation.ts
│   ├── domain/               # entidades, constantes y mappers
│   ├── theme/                # tokens.ts (escala cruda) + index.ts (roles)
│   ├── ui/                   # design system (24 componentes)
│   └── features/             # una carpeta por área de negocio
│       ├── account/          # ciclo de vida de la cuenta propia: api · screens
│       ├── auth/             # api · model (ingreso rápido) · components · session · screens
│       ├── businesses/       # api · state · components · screens
│       ├── client/           # modo cliente: api · state · components · screens
│       ├── debtors/          # api · components · screens
│       ├── debts/            # api · components
│       ├── legal/            # documentos legales: api · components · screens
│       ├── payments/         # api · components
│       ├── home/             # screens
│       └── profile/          # screens
├── scripts/use-env.js        # cambio de entorno multiplataforma
└── assets/
```

Dentro de una feature el patrón es siempre el mismo: `api/` (peticiones), `model/` si hace
falta, `components/` (piezas de esa feature), `screens/` (pantallas), `state/` solo si el
estado debe ser global.

### Alias de imports

```
@/*      → ./src/*
@app/*   → ./app/*
```

Se importa **siempre** por alias, nunca con `../../..`. El design system se importa desde
el barril: `import { Button, Screen, Text } from '@/ui'`.

### Los archivos de `app/` son de una línea

```tsx
/** Ruta `/clients` — pestaña de clientes. */
export { DebtorListScreen as default } from "@/features/debtors/screens/DebtorListScreen";
```

Así la pantalla se puede mover, reutilizar o probar sin pelear con el enrutador.

---

## FASE 3 — Navegación

| URL                  | Archivo                           | Pantalla                                             |
| -------------------- | --------------------------------- | ---------------------------------------------------- |
| `/`                  | `app/index.tsx`                   | Puerta de entrada: splash + redirección según sesión |
| `/login`             | `app/(auth)/login.tsx`            | Login (correo **o** documento)                       |
| `/register`          | `app/(auth)/register.tsx`         | Registro                                             |
| `/home`              | `app/(app)/(tabs)/home.tsx`       | Inicio: total por cobrar y quién debe                |
| `/clients`           | `app/(app)/(tabs)/clients.tsx`    | Lista de clientes                                    |
| `/businesses`        | `app/(app)/(tabs)/businesses.tsx` | Lista de negocios                                    |
| `/profile`           | `app/(app)/(tabs)/profile.tsx`    | Perfil y ajustes                                     |
| `/client/[id]`       | `app/(app)/client/[id].tsx`       | **Detalle del cliente** (pantalla núcleo)            |
| `/client/new`        | `app/(app)/client/new.tsx`        | Registrar cliente                                    |
| `/business/new`      | `app/(app)/business/new.tsx`      | Crear negocio                                        |
| `/business/transfer` | `app/(app)/business/transfer.tsx` | Pasarle el negocio a un miembro (`?businessId=`)     |
| `/settings/profile`  | `app/(app)/settings/profile.tsx`  | Editar perfil                                        |
| `/settings/security` | `app/(app)/settings/security.tsx` | Cambiar contraseña                                   |
| `/settings/delete-account` | `app/(app)/settings/delete-account.tsx` | Eliminar la cuenta propia               |
| `/settings/deactivate-account` | `app/(app)/settings/deactivate-account.tsx` | Desactivar la cuenta propia (reversible) |
| `/wallet`            | `app/(app)/(client)/wallet.tsx`    | **Modo cliente**: cuánto debo y en qué tiendas      |
| `/movements`         | `app/(app)/(client)/movements.tsx` | Modo cliente: extracto de todas las tiendas         |
| `/me`                | `app/(app)/(client)/me.tsx`        | Modo cliente: perfil (igual que `/profile`)         |
| `/store/[id]`        | `app/(app)/store/[id].tsx`         | Modo cliente: mi cuenta en una tienda               |
| `/legal`             | `app/legal/index.tsx`             | Lista de documentos legales vigentes                 |
| `/legal/[type]`      | `app/legal/[type].tsx`            | Documento legal vigente; `type` = código del catálogo |
| —                    | `app/+not-found.tsx`              | Ruta inexistente (deep link roto)                    |

Reglas:

- **Nunca escribas una ruta como string.** Usa `routes` de `@/core/navigation/routes`:
  `router.push(routes.client.detail(id, businessId))`.
- Las subrutas usan **singular** (`/client/new`) y las pestañas **plural** (`/clients`), para
  que jamás coincidan dos archivos en la misma URL.
- Los grupos `(auth)`, `(app)`, `(tabs)` no aparecen en la URL; sirven para colgar layouts.
- `app/(app)/_layout.tsx` es la **guardia de sesión**: sin sesión redirige a `/login`.
  `app/(auth)/_layout.tsx` hace lo contrario. Ninguna pantalla debe comprobar la sesión.
- `app/(app)/_layout.tsx` envuelve la app en `LegalGate`: si el backend dice que hay
  documentos legales vigentes sin aceptar, se muestra la pantalla de aceptación en lugar
  de la app. Sin red no bloquea.
- **La app no tiene lista de tipos de documento legal.** El backend tiene un catálogo
  (`LegalDocumentKind`) y cada documento llega con `title`, `audience` y `required`.
  Nunca filtres por tipos conocidos ni pongas etiquetas por tipo: si el backend agrega
  uno, la app lo muestra sola, y si lo descartara mandaría menos aceptaciones de las que
  el backend exige.
- `app/legal/` cuelga de la **raíz**, no de `(auth)` ni de `(app)`: un documento legal se
  lee antes de tener cuenta y también después, y esos dos grupos redirigen según la
  sesión. Cualquier pantalla que deba verse desde los dos lados va ahí.
- Los formularios se presentan como `modal` en iOS y `card` en Android (ya configurado).
- La barra de pestañas es propia: `src/ui/TabBar.tsx`. Hay **dos** juegos de pestañas,
  uno por modo: `(tabs)` para el tendero y `(client)` para el cliente. Cuál se ve lo
  decide `AppModeProvider`; quien navega entre ellos es `ModeSwitcher` o la puerta de
  entrada, siempre con `router.replace` (son dos raíces, no una encima de la otra).

---

## FASE 4 — Estado

**Tres providers globales**, montados en `app/_layout.tsx`:

| Provider           | Hook              | Para qué                                                                      |
| ------------------ | ----------------- | ----------------------------------------------------------------------------- |
| `SessionProvider`  | `useSession()`    | `status`, `user`, `login(credenciales, { remember })`, `register`, `logout(opciones)`, `endSession`, `patchUser` |
| `BusinessProvider` | `useBusinesses()` | negocios, **negocio activo** (persistido), **negocio principal** (`favoriteBusinessId`, por usuario), `selectBusiness`, `setFavoriteBusiness`, `createBusiness`, `refresh`, `refreshIfStale` |
| `AppModeProvider`  | `useAppMode()`    | **modo** `merchant` / `client` (persistido), tiendas donde al usuario le fían, `setMode`, `refreshAccounts` |

Todo lo demás **no** es estado global: clientes, deudas y pagos los carga cada pantalla con
los hooks del núcleo. Si necesitas datos en una pantalla nueva, el orden de preferencia es:

1. `useAsyncData(fetcher, { enabled, deps })` — un recurso: da `data`, `status`, `error`,
   `isLoading`, `isRefreshing`, `reload`, `refresh`, `setData`. Cancela resultados obsoletos.
2. `usePagedList(fetchPage, { pageSize, enabled, deps })` — listas con scroll infinito:
   `items`, `isLoading`, `isRefreshing`, `isLoadingMore`, `hasMore`, `loadMore`, `refresh`.
   Deduplica por `id` al concatenar páginas.
3. Un provider nuevo **solo** si el dato lo necesitan varias ramas del árbol a la vez.

`useSession().status` es `'loading' | 'authenticated' | 'unauthenticated'`. **Nunca** deduzcas
la sesión de otra cosa.

**La lista de negocios, y con ella el rol del usuario, se mantiene al día sola.** Otra
persona puede cambiarla con la app abierta: sacarlo del equipo, cambiarle el rol o pasarle
un negocio. `BusinessProvider` la vuelve a pedir **en silencio**, sin spinner, con 15 s
mínimo entre consultas y nunca dos a la vez:

- cuando la app vuelve del fondo;
- al entrar a las pantallas que muestran el rol, con `useRefreshBusinessesOnFocus()`. Hoy
  son Inicio, Mis negocios, Perfil y Equipo; úsalo en cualquier pantalla nueva que dependa
  del rol;
- cuando una petición con `x-business-id` responde 403. El cliente HTTP lo avisa por
  `onBusinessForbidden` (`core/http/businessAccess.ts`).

`refresh()` es la recarga con indicador (pull-to-refresh, reintentar).

**Con qué negocio abre la app.** El usuario marca un negocio **principal** con la estrella
de "Mis negocios" (solo aparece con dos negocios o más), y la app abre **siempre** en él:
al iniciar sesión y al volver a abrirla. El orden lo resuelve `BusinessProvider` y ninguna
pantalla lo repite:

1. el principal, si sigue en la lista;
2. si no hay principal, el último usado (solo existe si la sesión venía de antes);
3. si tampoco, `defaultBusiness()` de `@/domain/models`: el más antiguo del que es dueño.
   **Nunca** `businesses[0]`: `GET /business` viene por fecha de creación descendente, y
   eso hacía abrir siempre el último creado.

Una vez dentro, el negocio que el usuario elige se respeta hasta que cierre la app: una
respuesta tardía del servidor no lo devuelve al principal. El principal se guarda en el
dispositivo, por usuario (`favorite_businesses`), y no viaja a otros celulares; si el
principal desaparece de la lista del servidor, se olvida solo. Marcarlo **no** cambia el
negocio activo.

---

## FASE 5 — Datos y backend

### Entorno

Variables en `.env` (plantilla en `.env.example`), leídas y validadas **una vez** en
`src/core/config/env.ts`. Nunca uses `process.env` fuera de ese archivo.

| Variable                      | Uso                                                   |
| ----------------------------- | ----------------------------------------------------- |
| `EXPO_PUBLIC_ENVIRONMENT`     | `local` \| `dev` \| `prd` — controla el nivel de logs |
| `EXPO_PUBLIC_API_BASE_URL`    | Base del API incluyendo `/api`                        |
| `EXPO_PUBLIC_API_AUTH_PREFIX` | Prefijo de auth (default `/auth`)                     |
| `EXPO_PUBLIC_API_TIMEOUT_MS`  | Timeout HTTP (default 20000)                          |

Cambio de entorno: `npm run env:local` / `env:dev` / `env:prd` (script Node, funciona en
Windows **y** macOS, necesario porque el build de iOS se hace en Mac).

⚠️ En desarrollo la URL debe ser la **IP LAN** de tu máquina, no `localhost`: un celular
físico o el simulador de iOS no alcanzan el localhost del PC. `env.ts` te avisa si lo detecta.
Todo lo que empiece por `EXPO_PUBLIC_` **viaja en el bundle**: nunca metas secretos.

### Cliente HTTP

Un solo cliente: `http` en `src/core/http/client.ts` (axios). Hace:

- adjunta el `Bearer` leyéndolo **de memoria** (`tokenStore`), no de AsyncStorage por request;
- renueva la sesión en un 401 con patrón **single-flight** (una sola renovación compartida)
  y reintenta la petición original;
- **renueva antes de que venza**: si al access token le queda menos de un minuto, lo cambia
  antes de enviar la petición;
- solo un **401** del refresh cierra la sesión (limpia credenciales y avisa por
  `onSessionExpired`, que el `SessionProvider` escucha para volver al login). Un fallo de
  red o un 502 del servidor despertando se propagan sin echar al usuario;
- convierte **todo** error a `AppError` antes de propagarlo;
- registra con el logger, que **redacta** tokens y contraseñas.

Helpers: `businessHeader(businessId)` y `skipAuthRefresh` (para login/logout/registro, donde
un 401 no es una sesión vencida).

Normalización de respuestas (`src/core/http/payload.ts`) — el backend responde a veces
`{ data, meta }` y a veces el recurso pelado:

```ts
toList<T>(payload); // → T[], nunca undefined
toPage<T>(payload, page, limit); // → { items, meta } con meta completa
toItem<T>(payload); // → T | null
toAmount(value); // "15000.00" → 15000
```

### Sesión y dispositivo

El backend mantiene **una sesión por dispositivo** y **rota** el refresh token. De ahí tres
reglas que no se pueden saltar:

1. **El login manda `deviceId`** (obligatorio; sin él responde 400) y `deviceName`. Los dos
   salen de `@/core/device/deviceIdentity`: un UUID v4 creado la primera vez y guardado en
   `device_id`, más marca, modelo y sistema operativo. Nunca se arman a mano.
2. **`device_id` NO se borra al cerrar sesión.** Identifica el aparato, no a la persona.
3. **Nunca dispares dos renovaciones con el mismo refresh token.** El servidor lo lee como
   un robo y cierra la sesión. El `single-flight` del cliente HTTP ya lo garantiza: no
   llames al endpoint de refresh desde ningún otro sitio.

El límite de intentos de login (5 por minuto) llega como **429** → `AppError('RATE_LIMITED')`.
Se muestra el mensaje y **no se reintenta solo**.

### Recuperar la contraseña

`/forgot-password` (`features/auth/screens/ForgotPasswordScreen.tsx`) es una sola pantalla
con tres pasos: correo → código de 6 dígitos → contraseña nueva. Usa
`authApi.requestPasswordReset`, `verifyPasswordResetCode` y `resetPassword`
(`/auth/password/forgot`, `verify-code` y `reset`). Reglas:

1. **Nunca digas si el correo tiene cuenta.** El backend responde 200 igual; la app siempre
   pasa al paso del código con un texto condicional ("Si … es el correo de una cuenta").
2. **El reenvío espera 60 s.** Es lo que espera el backend; antes de eso ignora el pedido.
3. Los errores del código llegan como el mismo **400** (equivocado, vencido o agotado) y se
   pintan junto al campo con el texto del backend. Si `reset` responde así, se vuelve al
   paso del código.
4. `reset` **cierra todas las sesiones y no inicia sesión**: se termina en el login.

### Ingreso rápido (recordar los datos)

Opcional: la casilla "Recordar mis datos en este celular" del login guarda el identificador
y la contraseña, y la próxima vez se entra con la huella, el rostro o el PIN/patrón del
celular. Vive en `src/features/auth/model/rememberedLogin.ts`. Reglas:

- **La contraseña nunca va a AsyncStorage.** Va cifrada en `SecureStore` (Keychain /
  Keystore) por medio de `@/core/storage/secureStorage`, y solo se lee **después** de que
  `authenticateOwner()` (`@/core/device/deviceAuth`) diga que quien tiene el teléfono es su
  dueño. Cualquier otro secreto que se agregue sigue el mismo camino.
- Solo se guarda tras un login **aceptado por el backend**: lo hace `login(credenciales,
  { remember: true })` antes de marcar la sesión como iniciada. `remember: false` olvida los
  datos si son de esa cuenta; sin `remember` no se toca nada (es el propio ingreso rápido).
- Sin bloqueo de pantalla no se ofrece, y si el teléfono lo pierde, lo guardado se borra.
- `logout()` y la sesión vencida **no** lo borran: es para volver a entrar. Cambiar la
  contraseña lo **actualiza** con la nueva (`updateRememberedPassword`). Desactivar y
  eliminar la cuenta lo **borran** en cuanto el backend confirma (`forgetRememberedLoginOf`),
  sin esperar al diálogo. Un 401 del ingreso rápido lo borra y pide la contraseña.
- Se apaga desde Perfil → "Entrar sin contraseña", pero **no se enciende desde ahí**:
  comprobar la contraseña obligaría a un login encima de la sesión viva, y el refresh
  token rotado de una renovación en vuelo se leería como un robo (regla 3 de arriba).
- El aviso de huella se lanza solo **una vez por arranque** y solo si la app abrió sin
  sesión. Después de un logout no: quien sale suele querer entrar con otra cuenta.
- Quien pueda desbloquear el celular puede entrar con la cuenta recordada. La casilla lo
  dice ("actívalo solo si el celular es tuyo"); no lo escondas.

### Ciclo de vida de la cuenta y de los negocios

Lo maneja el módulo `account-lifecycle` del backend (su documento está en
`docs/modulos/account-lifecycle.md`). En la app:

| Acción | Dónde | Qué pasa |
| ------ | ----- | -------- |
| **Desactivar** la cuenta | Perfil → `/settings/deactivate-account` | Una pausa: se cierran todas las sesiones y **no se borra nada**. Sus negocios siguen activos para el equipo. Vuelve iniciando sesión. A los 48 meses sin volver, el backend la anonimiza |
| **Eliminar** la cuenta | Perfil → `/settings/delete-account` | Queda desactivada de inmediato y se anonimiza a los 15 días. Si es dueño, sus negocios se cierran; antes se le ofrece pasárselos a un miembro. Se arrepiente iniciando sesión |
| **Reactivar** | Login | 403 con `reason` `ACCOUNT_DEACTIVATED` o `ACCOUNT_DELETION_PENDING`: se ofrece reactivar y se repite el login con `reactivate: true`. `ACCOUNT_DISABLED` lo hizo un administrador: solo se muestra el aviso de soporte |
| **Pasar** un negocio | Perfil → `/business/transfer` | El dueño propone y el miembro acepta o rechaza desde `IncomingTransfersCard`, en Inicio y en Mis negocios. Hay 7 días para responder. Al aceptar, se llama `useLegalGate().recheck()` porque el nuevo dueño debe aceptar el acuerdo para negocios. El dueño se entera de la respuesta por **correo** (lo envía el backend) y en "Últimas propuestas" de la misma pantalla |
| **Cerrar** un negocio | Perfil → "Cerrar negocio" | El backend lo rechaza si hay deudas por cobrar. Cerrado, **deja de aparecer** en `GET /business` y sus datos se borran a los 6 meses |

Reglas:

- Desactivar, eliminar y cambiar la contraseña cierran la sesión **en el servidor**. Al
  terminar se usa `endSession()` (solo limpia el dispositivo), no `logout()`. Antes, cada
  pantalla borra o actualiza el ingreso rápido (ver «Ingreso rápido»).
- **La descarga en Excel se ofrece antes de cerrar**, no después: un negocio cerrado ya no
  aparece en la lista, así que después no hay de dónde descargarlo. Va en "Cerrar
  negocio" y en la tarjeta de cada negocio de "Eliminar cuenta". Mientras la rama
  `feature/business-export` no esté integrada, la app no ofrece descarga.
- Lo que el backend conserva después de eliminar una cuenta (los registros de seguridad
  del login, los datos de los negocios donde era cliente) lo explica la política de datos,
  no la app.

### Sin conexión

`src/core/connectivity.ts` (sobre `expo-network`) sabe si hay internet **antes** de
intentar nada, y expone dos puertas sobre la misma función para que la interfaz y la red
no puedan discrepar: `useConnectivity()` para componentes e `isOffline()` para el
interceptor de axios.

Qué pasa cuando no hay red, sin que ninguna pantalla tenga que programarlo:

- el interceptor de peticiones **corta de inmediato** con `AppError('NETWORK')` en vez de
  dejar morir la petición contra el timeout de 60 s, así que un formulario avisa al
  instante;
- `OfflineBanner`, montado una sola vez en `app/_layout.tsx`, muestra la píldora de aviso;
- `ErrorState` detecta que el dispositivo está sin red y pinta `OfflineState` en vez del
  error genérico, de modo que **todas** las pantallas dicen lo correcto;
- `useAsyncData` recarga sola en cuanto vuelve la conexión, y mientras tanto conserva lo
  que haya en caché con `StaleNotice`.

Regla derivada: **nunca afirmes un vacío que no te consta**. Si una lista vino vacía
porque la petición falló, no se dice "no tienes nada" —se muestra el error—. Vale para
negocios, clientes y tiendas del modo cliente.

### Errores

**Un** modelo: `AppError` con `code` cerrado (`NETWORK`, `TIMEOUT`, `UNAUTHORIZED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`, `RATE_LIMITED`, `SERVER`, `CANCELLED`,
`UNKNOWN`),
`title` y `message` **ya escritos para el usuario**, más `fieldErrors` cuando el backend
dice qué campo falló. En un `catch`:

```ts
catch (caught) {
  const error = toAppError(caught);
  if (error.fieldErrors) { form.setFieldErrors(error.fieldErrors); return; }
  dialog.showError(error);   // título y mensaje ya resueltos
}
```

Nunca escribas un `switch` sobre códigos de error en una pantalla, y nunca dejes un error
solo en consola: si el usuario pidió algo y falla, el usuario debe verlo.

Cuando una pantalla sí tiene que distinguir un caso, usa `error.reason`: el código de
negocio que manda el backend en `error` (`ACCOUNT_DEACTIVATED`,
`BUSINESS_CLOSURE_ACK_REQUIRED`…). `error.payload` trae el resto del cuerpo de la
respuesta. Nunca compares el texto de `message`: es para personas y puede cambiar.

### Endpoints

| Método | Endpoint              | `x-business-id` | Módulo                                            |
| ------ | --------------------- | --------------- | ------------------------------------------------- |
| POST   | `/auth/login`         | —               | `authApi.login` (manda `deviceId` + `deviceName`; `reactivate: true` tras un 403 `ACCOUNT_DEACTIVATED` o `ACCOUNT_DELETION_PENDING`) |
| POST   | `/auth/logout`        | —               | `authApi.logout` (header `x-refresh-token`)       |
| POST   | `/auth/refresh`       | —               | interceptor de `client.ts` (header `x-device-id`) |
| POST   | `/users`              | —               | `authApi.register` (manda `acceptedLegalDocumentIds`) |
| GET    | `/legal/current`      | —               | `legalApi.current` · `forRegistration` (`?audience=ALL_USERS`) · `forBusiness` (`?audience=BUSINESS_OWNERS`); público, sin caché |
| GET    | `/legal/pending`      | —               | `legalApi.pending` (lo consulta `LegalGate`)      |
| POST   | `/legal/accept`       | —               | `legalApi.accept`                                 |
| PATCH  | `/users/:id`          | —               | `authApi.updateProfile` (**solo** nombre y apellido) |
| PATCH  | `/users/me/password`  | —               | `authApi.updatePassword` (pide la actual)         |
| POST   | `/users/me/deactivate` | —              | `accountApi.deactivate` (pide la contraseña; el backend cierra las sesiones) |
| GET    | `/users/me/deletion-preview` | —        | `accountApi.deletionPreview`                      |
| POST   | `/users/me/deletion`  | —               | `accountApi.requestDeletion` (pide la contraseña; el backend cierra las sesiones) |
| GET    | `/business`           | —               | `businessApi.list`                                |
| POST   | `/business`           | —               | `businessApi.create` (manda `acceptedLegalDocumentIds`) |
| PATCH  | `/business/:id/inactivate` | —          | `businessApi.close` (solo el dueño, sin deudas por cobrar) |
| POST · GET · DELETE | `/business/:id/ownership-transfer` | — | `ownershipApi.request` · `pending` · `cancel` (solo el dueño) |
| GET    | `/business/:id/ownership-transfers/history` | — | `ownershipApi.history` (las 3 últimas resueltas) |
| GET    | `/business/ownership-transfers/incoming` | — | `ownershipApi.incoming` (lo muestra `IncomingTransfersCard`) |
| POST   | `/business/ownership-transfers/:id/accept` · `/reject` | — | `ownershipApi.accept` · `reject` |
| GET    | `/debtors`            | ✅              | `debtorApi.listByBusiness`                        |
| GET    | `/debtors/me/all`     | —               | `debtorApi.listAll`                               |
| GET    | `/debtors/:id`        | ✅              | `debtorApi.getById`                               |
| POST   | `/debtors`            | ✅              | `debtorApi.create`                                |
| GET    | `/debtors/:id/debts`  | ✅              | `debtApi.listByDebtor` (trae los pagos embebidos) |
| POST   | `/debts`              | ✅              | `debtApi.create`                                  |
| GET    | `/debts/:id/payments` | ✅              | `paymentApi.listByDebt`                           |
| POST   | `/payments`           | ✅              | `paymentApi.create`                               |
| POST   | `/payments/global`    | ✅              | `paymentApi.createGlobal`                         |

Llaves de AsyncStorage (contrato, compatible con el v1): `auth_token`, `refresh_token`,
`auth_user`, más `active_business_id` y `app_mode`. Se acceden **solo** por `StorageKeys`,
y las tres últimas se borran al cerrar sesión para que la siguiente cuenta del dispositivo
no herede ni el negocio ni el modo.

Tres llaves **sobreviven al cierre de sesión**, a propósito:

- `device_id`: se escribe una vez e identifica la instalación ante el backend (ver «Sesión
  y dispositivo»);
- `favorite_businesses`: el negocio principal de cada usuario, como `{ [userId]: businessId }`.
  Es una preferencia de la persona y va por usuario, así que otra cuenta no la hereda;
- `remembered_login`: la **marca** del ingreso rápido (el `userId` dueño). Los datos van en
  `SecureStore` (llaves `remembered_login_account` y `remembered_login_password`, por
  `SecureKeys`). La marca está en AsyncStorage porque este se borra al desinstalar y el
  llavero de iOS no: sin marca, lo que quede en el llavero se descarta.

---

## FASE 6 — Design system

Los tokens están en `src/theme/tokens.ts` (escala cruda: `brand[500]`, `ink[800]`) y los
**roles** en `src/theme/index.ts` (`text`, `textMuted`, `border`, `danger`, `brand`…).
Los componentes consumen **roles**, nunca la escala. Cuando se agregue modo oscuro, basta
cambiar lo que devuelve `useTheme()`.

Identidad visual (paleta de Appuntao). Los tres colores de marca son **los del logotipo**,
medidos sobre `assets/images/icon.png`: la interfaz y el logo hablan el mismo azul.

| Color          | Hex       | Token        | En el logo                         | Rol                                                   |
| -------------- | --------- | ------------ | ---------------------------------- | ----------------------------------------------------- |
| Azul principal | `#0066FF` | `brand[500]` | Fondo del cuaderno / ícono         | `brand`: acciones primarias, foco, color protagonista |
| Azul oscuro    | `#0B2D6B` | `brand[800]` | Monograma y texto «puntao»         | `brandDeep`, `accentOn`: nombre de marca, detalles    |
| Verde lima     | `#B6FF00` | `lime[500]`  | Check y detalles del cuaderno      | `accent`: checks y detalles sobre superficies oscuras |
| Blanco frío    | `#F5F8FF` | `ink[50]`    | —                                  | `bg`: fondo de pantalla                               |

El resto de cada escala se **deriva** de esos colores (claros mezclando con blanco, oscuros
con `brand[800]` o con negro); si el logo cambia, se cambian los extremos y se recalcula la
escala, no se retoca un tono suelto. `brand[500]` da 4.8:1 sobre blanco: alcanza para
texto normal, pero nada más claro que `500` sirve como texto sobre blanco.

Los neutros (`ink`) llevan un tinte azul para conversar con la marca. La lima **nunca** va
como texto sobre blanco (1.2:1): se usa como relleno con texto `accentOn` (10.8:1) o como
detalle sobre los héroes oscuros. Se conservan rojo `#E14848` para deuda, ámbar para
vencimientos y verde `#00B26B` (`success`) para «pagado / al día». Los héroes usan el
degradado `theme.gradient.hero` (azul casi negro → azul oscuro).

- **`info` es cian (`#0891B2`), no azul**: un azul informativo se confunde con `brand` y un
  aviso parece una acción. Su texto sólido es oscuro (`infoOn` = `ink[900]`).
- **Sobre un héroe oscuro** no se escribe `rgba(...)`: los controles usan
  `fillInverse` (blanco 12 %) y las zonas o tarjetas `fillInverseSubtle` (blanco 8 %).
- **Colores de avatar** en `palette.avatar`: todos con texto blanco ≥ 3:1. Si se agrega uno,
  se mide antes.

### Componentes (`import { … } from '@/ui'`)

| Grupo         | Componentes                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Estructura    | `Screen`, `AppBar`, `TabBar`, `Card`, `Divider`, `Spacer`, `SectionHeader`                                |
| Texto         | `Text` (variantes de la escala), `AnimatedMoney` (cifra que cuenta)                                       |
| Acción        | `Button`, `IconButton`, `Fab`, `PressableScale`                                                           |
| Formulario    | `TextField`, `MoneyField`, `OptionPicker`, `SearchBar`, `SegmentedControl`, `Checkbox`, `CheckboxField` |
| Datos         | `Avatar`, `Badge`, `ListRow`, `StatTile`, `IconBubble`                                                    |
| Superposición | `Sheet` (bottom sheet con gesto), `Dialog` + `useDialog`, `ToastProvider` + `useToast`                    |
| Estados       | `Skeleton`, `RowSkeleton`, `ListSkeleton`, `CardSkeleton`, `EmptyState`, `ErrorState`, `OfflineState`, `ListFooterLoader` |
| Conectividad  | `OfflineBanner` (aviso global, va una sola vez en la raíz), `StaleNotice`                                  |

Reglas de uso:

- Toda pantalla se envuelve en `<Screen>`. Nada de `SafeAreaView` a mano ni de calcular
  insets: `Screen` y `AppBar` ya los aplican.
- Formulario → `<Screen scroll padded keyboardAware footer={<Button …/>}>`.
- Zona táctil presionable → `PressableScale` (animación + vibración uniformes).
- **Un `Dialog` que se abre desde una `Sheet` va después de cerrarla.** Son dos `Modal`, y
  si el diálogo aparece con la hoja todavía montada, queda detrás. Cierra la hoja y abre el
  diálogo en su `onClosed`, que se llama al terminar la animación. Ejemplo: "Quitar del
  negocio" en `TeamScreen`.
- Aviso sin decisión → `useToast()`. Aviso **con** decisión o error → `useDialog()`.
  Nunca `Alert.alert`.
- Lista → `FlatList` con `RowSkeleton` mientras carga y `EmptyState` / `ErrorState` según
  el caso. Nunca `ScrollView` + `.map()` para datos del servidor.
- Formularios → `useForm` de `@/core/hooks/useForm` con validadores de
  `@/core/utils/validation`. No hay react-hook-form ni zod; no los introduzcas.

### Movimiento y vibración

Animaciones con **Reanimated 4** (hilo de UI). Duraciones y springs vienen de
`theme.duration` y `theme.spring`. Vibración con `haptics` de `@/core/haptics`:
`select` (tocar), `tap` (abrir), `press` (acción primaria), `success`, `warning`, `error`.
Es un no-op en web y nunca lanza.

---

## FASE 7 — Convenciones de código

- **TypeScript `strict`** + `noUncheckedIndexedAccess`: acceder a `array[i]` da
  `T | undefined` y hay que manejarlo. Es a propósito.
- Componentes: `export const NombreScreen = () => …` (nombrados). El `default` solo existe
  en los archivos de `app/`.
- Props tipadas con una `interface` exportada (`export interface ButtonProps`).
- Nombres en inglés; comentarios y textos en español.
- Comentario de cabecera en cada archivo explicando **qué hace y por qué es así**.
  Los comentarios explican decisiones, no repiten el código.
- Secciones dentro de un archivo: `/* ── Título ─────── */`.
- Estilos siempre en `StyleSheet.create` al final del archivo, con tokens del tema.
- `console.log` está prohibido por lint: usa `createLogger('scope')`.
- Commits: prefijo `[appuntao]` + mensaje corto en minúsculas.
- **No hay tests configurados.** La verificación es `npm run typecheck` + `npm run lint` +
  `npx expo export` + prueba manual. No afirmes que "los tests pasan".

---

## FASE 8 — Android + iOS (obligatorio en todo cambio)

### Proyectos nativos

Este proyecto usa **Continuous Native Generation**: `android/` e `ios/` **no** están en el
repo (a diferencia del v1, que tenía `android/` commiteado) y se generan con

```bash
npm run prebuild:android      # o: npx expo prebuild -p android
npm run prebuild:ios          # SOLO macOS
```

Ventaja: cambiar `app.json` (un plugin, un permiso, un icono) se refleja al regenerar, sin
editar Gradle a mano ni resolver conflictos en archivos nativos.

- `app.json`: `newArchEnabled: true`, `edgeToEdgeEnabled: true` (Android),
  `supportsTablet: true` (iOS), `orientation: portrait`, bundle/package `com.yair77.appuntao`.
- **EAS Build ya está configurado** (`eas.json` con los perfiles `development`, `preview` y
  `production`). Es lo que permite compilar el APK de demostración, y compilar iOS desde
  Windows sin tener un Mac. El detalle está en la **Fase 11**.

### Reglas de paridad

1. **Áreas seguras**: nunca calcules insets a mano. `Screen` y `AppBar` usan
   `useSafeAreaInsets()`, y `Screen`/`Fab`/`TabBar` aplican el inset **inferior** (barra de
   gestos). Esto corrige el `44` fijo del v1, que se quedaba corto en iPhone con notch.
2. **Teclado**: `<Screen keyboardAware>` en formularios. `Sheet` ya lo trae.
3. **Sombras**: usa `theme.shadow.*`, que declara `shadow*` (iOS) y `elevation` (Android).
4. **Gestos dentro de un `Modal`**: en Android hay que re-montar `GestureHandlerRootView`
   dentro del modal. `Sheet` ya lo hace; si creas otra superposición con gestos, cópialo.
5. **Permisos**: si activas cámara, ubicación o notificaciones hay que añadir el config
   plugin y los textos de iOS (`NSCameraUsageDescription`, etc.) en `app.json` y **volver a
   hacer prebuild**. Face ID ya está declarado: lo escriben **dos** plugins
   (`expo-local-authentication` y `expo-secure-store`) en `NSFaceIDUsageDescription`, y
   los dos llevan el mismo texto en español; si cambias uno, cambia el otro o el que gane
   dejará el suyo. En Expo Go para iOS no hay Face ID: el ingreso rápido pide el código.
6. **Push en iOS** requiere build nativo con EAS + APNs; no funciona en Expo Go.
7. **Tema claro fijo** (`userInterfaceStyle: light`). La estructura de roles está lista para
   modo oscuro, pero no está activado: no asumas que funciona.
8. Medidas relativas con `useWindowDimensions()`; nada de anchos de pantalla fijos (iPad).
9. **Prueba en las dos plataformas** antes de cerrar un cambio. Si no puedes probar una,
   **dilo explícitamente**.

---

## FASE 9 — Comandos

```bash
npm install              # instala exactamente lo del package-lock
npm start                # expo start
npm run start:clear      # expo start --clear (tras cambiar .env o alias)
npm run android          # build nativo Android (requiere Android SDK)
npm run ios              # build nativo iOS (SOLO macOS)
npm run typecheck        # tsc --noEmit          ← debe quedar en 0
npm run lint             # expo lint             ← debe quedar en 0
npm run env:dev          # activa .env.dev
npx expo export --platform android --platform ios   # compila los bundles: verificación real
npx expo-doctor          # 17/18: falla solo el check de versiones (ver Fase 0.1)

# EAS Build (requiere `npm install -g eas-cli` y `eas login`)
npm run build:android        # APK de demostración (perfil preview)
npm run build:android:prod   # AAB para Google Play (perfil production)
npm run build:android:dev    # APK con development client (perfil development)
npm run build:ios            # IPA (perfil preview) — compila en la nube, no hace falta Mac
npm run builds               # últimos 10 builds y su estado
```

---

## FASE 10 — Checklist antes de dar un cambio por terminado

- [ ] `npm run typecheck` en 0 errores.
- [ ] `npm run lint` en 0 problemas.
- [ ] ¿Funciona en **Android y iOS**? (insets, teclado, sombras, gestos en modales)
- [ ] ¿Textos en **español** y dinero con `formatMoney`?
- [ ] ¿Cero colores/paddings literales? ¿Todo desde `@/theme`?
- [ ] ¿Componentes desde `@/ui` en vez de primitivas sueltas de React Native?
- [ ] ¿Rutas desde `routes` en vez de strings?
- [ ] ¿La petición va por `http` de `@/core/http/client` y con `businessHeader` si toca
      clientes, deudas o pagos?
- [ ] ¿La respuesta pasa por un mapper de `@/domain/mappers`?
- [ ] ¿Los errores llegan al usuario (`useDialog` / `useToast`), no solo a la consola?
- [ ] ¿Hay estado de carga (skeleton), vacío y error?
- [ ] ¿Se guarda algo secreto (una contraseña, una llave)? Va en `SecureStore` por
      `@/core/storage/secureStorage`, nunca en AsyncStorage.
- [ ] ¿La pantalla elige un negocio por su cuenta? No: el de arranque lo decide
      `BusinessProvider` (principal → último usado → `defaultBusiness`), nunca `businesses[0]`.
- [ ] ¿Las versiones siguen intactas? (`dependencies` de `package.json` y `package-lock.json`
      sin tocar)
- [ ] Si el cambio toca `app.json`, `eas.json` o una variable `EXPO_PUBLIC_*`:
      ¿se actualizó también el bloque `env` del perfil correspondiente en `eas.json`?
      (el `.env` local **no** viaja a EAS — ver Fase 11)
- [ ] ¿Se dijo con claridad qué se probó y qué no?

---

## FASE 11 — Despliegue con EAS Build

Compilar en la nube de Expo en vez de en la máquina. Resuelve dos cosas que este proyecto
necesita: entregarle un **APK instalable** a un cliente sin pasar por Google Play, y compilar
**iOS desde Windows** (EAS tiene los Mac; aquí no hay ninguno).

Encaja con la CNG de la Fase 8: EAS corre `expo prebuild` en el servidor a partir de
`app.json`, así que `android/` e `ios/` siguen sin estar en el repo.

El detalle completo está en [`claude/despliegue/`](claude/despliegue/eas-build-android.md);
esta fase es el resumen operativo.

### 11.1 La regla que rompe todo si se olvida ⚠️

**El `.env` no viaja a EAS.** Está en `.gitignore`, y EAS Build sube al servidor solo lo que
git conoce. Un build que dependa del `.env` local sale con la URL del API vacía y la app
falla en cuanto el usuario intenta entrar.

Por eso las variables `EXPO_PUBLIC_*` están declaradas **dentro de `eas.json`**, en el bloque
`env` de cada perfil. Son las mismas que documenta la Fase 5 y siguen sin poder contener
secretos: `EXPO_PUBLIC_` significa que el valor queda escrito dentro del bundle y cualquiera
puede leerlo descompilando el APK.

Si agregas o cambias una variable en `.env`, **agrégala también en `eas.json`** en los
perfiles `preview` y `production`. El `.env` sirve para `npm start`; `eas.json` para los
builds de la nube.

El perfil `development` es la excepción y no declara `env`: ese build carga el JavaScript
desde tu Metro local, así que aplica tu `.env` de la máquina en tiempo real.

### 11.2 Requisitos, una sola vez

```bash
npm install -g eas-cli        # el CLI es global a propósito: no toca las versiones del proyecto
eas login                     # tu cuenta de expo.dev ES tu cuenta de EAS, es el mismo login
eas init                      # vincula el repo y escribe extra.eas.projectId en app.json
```

`eas init` es el único paso que modifica `app.json`: le añade el `projectId`. Ese cambio
**sí se commitea**, porque identifica el proyecto ante EAS.

`eas-cli` se instala global y **no** se agrega a `dependencies`: la Fase 0 congela las
versiones del proyecto y un CLI de build no tiene por qué entrar en ese contrato.

### 11.3 Los perfiles de `eas.json`

| Perfil        | Artefacto Android  | Para qué                                                  |
| ------------- | ------------------ | --------------------------------------------------------- |
| `development` | APK (debug)        | Development client: probar en dispositivo con Metro local |
| `preview`     | **APK**            | **Demostración a clientes**: se instala desde un link     |
| `production`  | AAB (`app-bundle`) | Subir a Google Play (Play solo acepta AAB)                |

`preview` y `production` usan `distribution: internal` / tienda respectivamente. Un **APK** se
instala directo desde el link que devuelve EAS; un **AAB** no se puede instalar a mano, solo
subir a Play. Para mostrarle la app a alguien, siempre `preview`.

`development` requiere además `npx expo install expo-dev-client`, que hoy **no** está
instalado: ese perfil no funcionará hasta que se agregue.

### 11.4 Compilar el APK de demostración (Android)

```bash
npm run build:android        # eas build --platform android --profile preview
```

EAS pregunta por el **keystore** la primera vez; deja que lo genere y lo guarde él
(`Generate new keystore`). Es la firma de la app: si se pierde, Google Play ya no acepta
actualizaciones de ese paquete. Queda en la cuenta de Expo y se recupera con
`eas credentials`.

Al terminar, EAS devuelve un link y un QR. El cliente abre el link en el celular, descarga el
APK y Android le pedirá permitir «instalar apps de origen desconocido» — es normal fuera de
Play y conviene avisarlo antes de la demostración.

`npm run builds` lista los últimos builds con su estado y su link, por si se cerró la terminal.

### 11.5 Versión y `versionCode`

`eas.json` declara `appVersionSource: "remote"`: **EAS lleva la cuenta** del `versionCode` de
Android y del `buildNumber` de iOS, y el perfil `production` los incrementa solo
(`autoIncrement: true`). No los edites a mano en `app.json`.

Lo que sí se edita a mano es `expo.version` de `app.json` (`1.0.0`), que es la versión que ve
el usuario. Súbela cuando el cambio lo amerite.

### 11.6 Pendientes conocidos

- **No hay backend público.** `eas.json` lleva el placeholder
  `https://REEMPLAZAR-CON-TU-API-PUBLICA/api`. Hasta que el API de `../fiao-backend` esté
  desplegado con HTTPS, el APK compila pero **no conecta**. Mientras tanto se puede probar
  contra el backend local a través de un túnel HTTPS: ver
  [`claude/despliegue/probar-con-backend-local.md`](claude/despliegue/probar-con-backend-local.md).
- **HTTPS obligatorio.** Android bloquea el tráfico HTTP plano desde Android 9. Si el API
  quedara en `http://`, hay que instalar `expo-build-properties` y habilitar
  `usesCleartextTraffic` en `app.json` — mejor desplegar con HTTPS que abrir ese agujero.
- **EAS Update no está configurado** (no hay `expo-updates` ni canales). Cada cambio exige
  recompilar; no hay actualizaciones por aire.
- **EAS Submit** tiene el bloque `production` vacío: falta la cuenta de servicio de Google
  Play para poder subir con `eas submit`.
- **iOS**: `npm run build:ios` funciona desde Windows, pero exige una cuenta de **Apple
  Developer de pago** (99 USD/año) y, para repartir la demo, registrar los UDID de los
  dispositivos (`eas device:create`) o pasar por TestFlight. Android no tiene ese requisito,
  por eso va primero.
