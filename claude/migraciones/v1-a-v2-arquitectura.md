# De Fiao v1 a la arquitectura v2 — qué cambia y por qué

Documento de referencia de la migración en curso en la rama `refactor/v2-arquitectura`.
Se ejecuta **dentro de este mismo repositorio** (no en uno aparte): se reemplaza el código
existente por fases, cada una verificada (`npm run typecheck` + `npm run lint`) antes de
validado (`tsc --noEmit` 0 errores, `expo lint` 0 problemas, `expo-doctor` 18/18,
`expo export` compilando para Android e iOS).

---

## 1. Lo que **no** cambia

- **El backend.** Los 17 endpoints son los mismos, con los mismos headers
  (`x-business-id`, `x-refresh-token`) y los mismos cuerpos. No hay que tocar el servidor.
- **Las llaves de AsyncStorage**: `auth_token`, `refresh_token`, `auth_user`. Una sesión
  guardada antes de la migración sigue siendo válida después.
- **Las versiones de React, React Native y Expo**: `19.1.0` / `0.81.4` / `54.0.1`, pineadas
  exactas y declaradas en `expo.install.exclude`. La compatibilidad de dispositivos es
  idéntica.
- **Los identificadores de la app**: `com.yair77.fiao` en Android e iOS.
- **Las funcionalidades.** Ver la tabla de paridad (sección 5).

---

## 2. Bugs corregidos con esta migración

| #   | Bug anterior                                                                                                            | Efecto                                                                                              | Corrección                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `app/index.tsx` con `const isAuthenticated = false` fijo                                                                | La app **siempre** mandaba al login aunque hubiera sesión guardada                                  | La puerta de entrada usa `useSession().status`, que rehidrata desde AsyncStorage                          |
| 2   | El refresh mandaba los headers en el _body_: `axios.post(url, { headers })`                                             | `x-refresh-token` nunca llegaba → la renovación de sesión **no funcionaba**                         | Se envían como headers reales; además single-flight y reintento de la petición original                   |
| 3   | `console.log` del access token, el refresh token y el cuerpo de cada respuesta                                          | Credenciales en cualquier captura de logs                                                           | `createLogger` con niveles y `redact()` que enmascara llaves sensibles; en producción solo `warn`/`error` |
| 4   | `ClientContext.addClient` capturaba el error y no lo re-lanzaba, pero la pantalla navegaba atrás igual                  | El tendero creía haber creado un cliente que nunca se creó                                          | El error sube, la pantalla se queda con los datos y muestra el motivo                                     |
| 5   | Sin guardia de sesión en las rutas                                                                                      | Cualquier pantalla era alcanzable sin sesión y fallaba con 401                                      | `app/(app)/_layout.tsx` redirige a `/login`; `(auth)` hace lo contrario                                   |
| 6   | `Header` con `Platform.OS === 'android' ? StatusBar.currentHeight : 44`                                                 | El `44` fijo se queda corto en iPhone con notch/Dynamic Island; el inset inferior no se contemplaba | `useSafeAreaInsets()` en `Screen`, `AppBar`, `Fab` y `TabBar`                                             |
| 7   | Sin manejo de sesión expirada                                                                                           | Token muerto lanzando 401 en cada pantalla                                                          | `onSessionExpired` → el `SessionProvider` cierra sesión y vuelve al login                                 |
| 8   | Sin ruta 404                                                                                                            | Un deep link mal escrito dejaba la app en blanco                                                    | `app/+not-found.tsx`                                                                                      |
| 9   | Errores de carga solo en `console.error`                                                                                | Pantalla vacía sin explicación                                                                      | `ErrorState` con mensaje y botón de reintentar                                                            |
| 10  | Intent-filter de deep link con `android:scheme="Fia y confía"` (inválido: espacios y tilde) en el `android/` commiteado | Los deep links `fiao://` nunca calzaban con el filtro real                                          | Al regenerar el proyecto nativo con CNG desde `app.json` (`scheme: "fiao"`), el filtro queda correcto     |

---

## 3. Deuda técnica eliminada

| Problema anterior                                                                                                                   | Cómo queda                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Pantallas duplicadas**: `(tabs)/clients.tsx` ≈ `(client)/clientList.tsx`, `(tabs)/businesses.tsx` ≈ `(business)/businessList.tsx` | Una sola de cada: `DebtorListScreen` (parametrizable) y `BusinessListScreen` |
| `formatCurrency`, `getInitials`, `getAvatarColor`, `normalizeText` copiadas en varios archivos                                      | Una vez en `src/core/utils/format.ts`                                        |
| 3 clases de error equivalentes (`AuthError`, `UserServiceError`, `RegisterError`) + un `switch` por pantalla                        | Un `AppError` con el mensaje de usuario ya resuelto                          |
| 2 clientes HTTP (axios con interceptores + `fetch` a mano en `services/`)                                                           | Un solo cliente `http`                                                       |
| 5 providers anidados (Auth, Business, Client, Debts, Payments)                                                                      | 2 providers (sesión y negocios) + hooks de datos por pantalla                |
| El patrón `data?.data ?? data ?? []` repetido en cada context                                                                       | `toList` / `toPage` / `toItem` en un sitio                                   |
| Cada formulario con su `useState` por campo y su `validateForm()`                                                                   | `useForm` + validadores componibles                                          |
| `ScrollView` + `.map()` para listas del servidor                                                                                    | `FlatList` con reciclaje                                                     |
| Alertas inconsistentes: `CustomAlert` en auth, `Alert.alert` nativo en el resto                                                     | `useDialog()` (decisión) y `useToast()` (aviso) en toda la app               |
| Archivos vacíos: `registerBussiness.ts`, `Support.tsx`, `editNotifiaction.tsx`                                                      | No existen                                                                   |
| Rutas como strings literales                                                                                                        | `routes.ts`                                                                  |
| Scripts de entorno con `copy` de cmd (rotos en macOS)                                                                               | `scripts/use-env.js`, multiplataforma                                        |
| `android/` commiteado: cambiar `app.json` no surtía efecto sin editar Gradle                                                        | CNG: `android/` e `ios/` se generan con `expo prebuild`                      |
| Importes relativos                                                                                                                  | Alias `@/` (→ `src/`) y `@app/` (→ `app/`) en todo el proyecto               |
| Tipos de dominio declarados dentro de los contexts                                                                                  | `src/domain/models.ts`                                                       |

---

## 4. Cambios de dependencias

### Eliminadas

| Paquete                                                                  | Motivo                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `@gluestack-ui/themed`, `@gluestack-ui/config`, `@gluestack-style/react` | Reemplazado por el design system propio en `src/ui`                                                                |
| `@react-native-aria/*` (3 paquetes)                                      | Solo existían como dependencias de gluestack                                                                       |
| `@react-native-picker/picker`                                            | Reemplazado por `OptionPicker` (bottom sheet), igual en iOS y Android                                              |
| `expo-camera`, `expo-location`, `expo-notifications`                     | Sin uso real en el código. Se reinstalan con `npx expo install <paquete>` cuando haya una feature que los necesite |
| `dotenv`, `react-native-dotenv`                                          | Redundantes: Expo ya carga `.env` y expone `EXPO_PUBLIC_*`                                                         |

### Añadidas (todas resueltas para SDK 54 vía `npx expo install`)

| Paquete                        | Para qué                                                 |
| ------------------------------ | -------------------------------------------------------- |
| `react-native-reanimated`      | Animaciones en el hilo de UI                             |
| `react-native-worklets`        | Requerido por Reanimated 4                               |
| `react-native-gesture-handler` | Gesto de arrastre de los bottom sheets                   |
| `expo-haptics`                 | Feedback táctil                                          |
| `expo-linear-gradient`         | Degradados de los héroes                                 |
| `expo-image`                   | Carga de imágenes con caché y transición                 |
| `expo-font`, `expo-linking`    | Peers que `@expo/vector-icons` y `expo-router` requieren |

---

## 5. Paridad funcional

Todas las funcionalidades actuales se conservan: login (correo o documento), registro,
persistencia de sesión, logout, refresh token, dashboard, negocios, clientes (por negocio y
globales), detalle de cliente con extracto unificado, agregar deuda, pago global, editar
perfil, cambiar contraseña. Se agregan: selector de negocio activo explícito, llamar al
cliente desde el detalle, filtros con contadores, pull-to-refresh, ruta 404.

---

## 6. Estado de la migración

Ver el checklist de fases en `CLAUDE.md` (Fase 0 en adelante) y el historial de commits de
la rama `refactor/v2-arquitectura` para el progreso real. Mientras una fase no esté
commiteada, el código de esa capa todavía no existe o convive temporalmente con el código
anterior.
