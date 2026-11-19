# 2026-11-10 — Ciclo de vida de la cuenta y de los negocios

El backend agregó el módulo `account-lifecycle` (rama `feature/account-lifecycle`). Esta
rama de la app, que sale de `feature/legal-consent`, integra lo que el backend ofrece.

## Por qué

- **App Store y Google Play** exigen que una app que permite crear cuentas también deje
  eliminarlas desde la app. Google pide además una página web que explique cómo pedirlo.
- La **Ley 1581** da el derecho de supresión de los datos personales.
- Un tendero que se va tiene que poder pasarle el negocio a alguien de su equipo, en lugar
  de que se cierre.

## Qué cambió

### Errores con código

`AppError` ahora conserva `reason`, el código que manda el backend en `error` (por
ejemplo `ACCOUNT_DEACTIVATED`), y `payload`, el cuerpo de la respuesta. Las pantallas
deciden comparando `reason`, no el texto del mensaje. `httpError` solo toma como `reason`
los valores en MAYÚSCULAS_CON_GUIONES, porque Nest pone ahí "Bad Request" por defecto.

### Eliminar la cuenta

Perfil → "Eliminar mi cuenta" (`/settings/delete-account`):

1. Muestra el plazo de gracia y los negocios de los que es dueño, con clientes y saldo por
   cobrar (`GET /users/me/deletion-preview`).
2. Si tiene negocios, ofrece pasárselos a un miembro y pide confirmar que se cerrarán.
3. Pide la contraseña y llama `POST /users/me/deletion`.
4. El backend ya cerró todas las sesiones, así que se usa `endSession` y no `logout`.

### Desactivar la cuenta

Perfil → "Desactivar mi cuenta" (`/settings/deactivate-account`) llama
`POST /users/me/deactivate` con la contraseña. Es una pausa: se cierran las sesiones, no
se borra nada y los negocios siguen funcionando para el equipo. A los 48 meses sin volver,
el backend la anonimiza. "Eliminar cuenta" la ofrece como alternativa ("¿Solo quieres
una pausa?").

### Reactivar desde el login

Si el login responde 403 `ACCOUNT_DEACTIVATED` o `ACCOUNT_DELETION_PENDING`, se ofrece
reactivar la cuenta y se repite el login con `reactivate: true`; eso también cancela una
eliminación pendiente. `ACCOUNT_DISABLED`, cuando la desactivó un administrador, solo
muestra el mensaje para contactar a soporte.

### Pasar un negocio

- **El dueño**, desde Perfil → "Pasar el negocio" (`/business/transfer`): elige a un
  miembro y confirma con su contraseña. Si ya hay una propuesta vigente, se muestra con la
  opción de cancelarla.
- **Quien la recibe** ve `IncomingTransfersCard` en Inicio y en Mis negocios, y acepta o
  rechaza. Al aceptar se refrescan los negocios, se elige ese como activo y se vuelve a
  consultar `LegalGate` (`useLegalGate().recheck()`): como nuevo dueño le toca el acuerdo
  para negocios.

### Cerrar un negocio

Perfil → "Cerrar negocio", con confirmación en rojo. Llama
`PATCH /business/:id/inactivate`, que el backend rechaza si hay deudas por cobrar, y avisa
la fecha en que se borrará su información. Un negocio cerrado ya no sale en
`GET /business`.

### Saber qué respondió el miembro (2026-11-18)

Antes, el dueño no se enteraba de la respuesta: solo podía deducirla. Ahora:

- **Correo.** El backend le escribe al dueño cuando el miembro acepta o rechaza. Si el
  envío falla, la respuesta queda guardada igual.
- **"Últimas propuestas"** en `/business/transfer`: las 3 últimas ya resueltas, con un
  badge (Aceptada, Rechazada, Vencida o Cancelada) y la fecha
  (`GET /business/:id/ownership-transfers/history`). Si esa consulta falla, la sección
  no aparece, porque es complementaria.

`OwnershipTransfer` ganó `status` y `respondedAt`.

### La confirmación de "Quitar del negocio" quedaba detrás (2026-11-18)

Al probar, en Equipo → miembro → "Quitar del negocio", la confirmación se abría con la
hoja todavía abierta y quedaba detrás de ella: había que cerrar la hoja a mano. Venía de
antes de esta rama.

Ahora la hoja se cierra primero y la confirmación se abre en su nuevo `onClosed`, que
`Sheet` llama al terminar la animación. La hoja también conserva el nombre del miembro
mientras baja, en vez de cambiar a "Gestionar".

### Datos viejos después de cambios en el equipo (2026-11-18)

Al probar se vio que el Perfil seguía mostrando a alguien como administrador de un negocio
del que ya lo habían sacado, y al entrar recibía "Sin permisos". La lista de negocios solo
se pedía al iniciar sesión o con el gesto de recargar.

Ahora `BusinessProvider` la vuelve a pedir en silencio cuando la app vuelve del fondo, al
entrar a Inicio, Mis negocios, Perfil o Equipo (`useRefreshBusinessesOnFocus`) y cuando una
operación de negocio responde 403 (`onBusinessForbidden`). `IncomingTransfersCard` también
vuelve a preguntar al recuperar el foco.

### El 409 al aceptar una propuesta cancelada

Al sacar a un miembro del equipo, el backend cancela la propuesta que tenía. Si el miembro
todavía veía la tarjeta y tocaba Aceptar, recibía "La transferencia ya fue respondida", que
confundía. El backend ahora responde según el estado: "Esta propuesta ya no está vigente: el
dueño la canceló o ya no eres parte del equipo", "Esta propuesta venció", "Ya aceptaste…",
"Ya rechazaste…". La tarjeta muestra el mensaje y se actualiza.

## Qué queda en otra rama

La descarga en Excel de la información de un negocio (`GET /business/:id/export`)
necesita `expo-file-system` y `expo-sharing`, que no están instaladas. Va en
`feature/business-export` para decidir aparte si se integra.

Tiene que ofrecerse **antes** de cerrar el negocio: desde que el backend dejó de listar
los negocios cerrados, después de cerrarlo ya no hay dónde tocar para descargarlo. Los
lugares son "Cerrar negocio" y la tarjeta de cada negocio en "Eliminar cuenta", que puede
mostrar cuándo se descargó por última vez (`lastExportedAt`).

## Qué se verificó

- `npm run typecheck`: 0 errores. `npm run lint`: 0 problemas.
- `npx expo export --platform android --platform ios`: los dos bundles compilan.

**Qué NO se verificó:** la prueba en dispositivo contra el backend con este módulo. Queda
por probar:

1. Desactivar la cuenta y reactivarla desde el login.
2. Eliminar una cuenta sin negocios, y luego entrar y conservarla.
3. Eliminar una cuenta con negocios: se pide la confirmación y se ofrece pasarlos.
4. Proponer un negocio, aceptarlo desde la otra cuenta y ver el acuerdo para negocios.
5. Rechazar y cancelar una propuesta: el dueño recibe el correo y la ve en "Últimas
   propuestas".
6. Cerrar un negocio con deudas (debe rechazarse) y sin deudas.
7. Una cuenta desactivada por un administrador: el login muestra el aviso de soporte.

## Despliegue en development (2026-11-19)

- Backend: `feature/account-lifecycle`, que incluye legal, unida a `develop`. Render aplicó
  las 4 migraciones (legal, ciclo de vida, transferencias y catálogo).
- Se publicaron en development los tres documentos legales como **borradores para revisión
  jurídica** (versión `2026-11-borrador`). Sus textos están en el backend, en `legal/`.
- App: `feature/account-lifecycle` unida a `dev`. El build para el equipo sale de `dev` con
  el perfil `preview`, que apunta a `https://fiao-backend.onrender.com/api`.
- **Las versiones viejas de la app no pueden registrarse ni crear negocios** contra
  development, porque no envían las aceptaciones. Hay que usar el build nuevo.
- Los usuarios que ya existían ven la pantalla de aceptación al entrar, y los dueños ven
  también el acuerdo para negocios.
