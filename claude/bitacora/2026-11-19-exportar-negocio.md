# 2026-11-19 — Descargar la información del negocio en Excel

Rama `feature/business-export`, que sale de `dev`. El backend ya tenía
`GET /business/:id/export` desde el módulo `account-lifecycle`; faltaba la app.

## Por qué

Un negocio cerrado deja de aparecer en la app, y su información se borra seis meses
después. El dueño tiene que poder llevarse sus clientes, deudas y abonos antes de cerrarlo
o de eliminar su cuenta. Los términos y el acuerdo de transmisión de datos lo prometen.

## Qué cambió

### Dependencias

Se instalaron con `npx expo install`, con autorización:

- `expo-file-system` `~19.0.24`, para guardar el archivo en la caché.
- `expo-sharing` `~14.0.8`, para abrir la hoja de compartir del teléfono.

Son módulos nativos: **hace falta un build nuevo** (EAS `preview`). El APK anterior no los trae.

### Descarga (`features/businesses/api/exportApi.ts`)

- Se pide con el cliente `http` de siempre y `responseType: 'arraybuffer'`. Así hereda la
  renovación de la sesión, el aviso de "sin conexión" y los `AppError`.
- El nombre del archivo sale de `Content-Disposition`.
- Se guarda en `Paths.cache` y se abre `Sharing.shareAsync`. Desde ahí el tendero lo guarda
  en Archivos o Drive, o lo manda por WhatsApp o correo.
- **En web** `expo-file-system` no escribe archivos (fallaba con "error inesperado" aunque
  el backend respondía 200). Ahí se descarga con un enlace `blob:`, como cualquier archivo
  del navegador.
- Como el cuerpo es binario, el mensaje del backend no se puede leer en un error. Para 403
  y 404 se pone uno propio.

### Dónde aparece

1. **Perfil → Negocio → "Descargar información"**, solo para el dueño del negocio activo.
   Está siempre a mano: sirve de respaldo y para el contador, no solo al irse.
2. **Al cerrar el negocio:** el diálogo de confirmación tiene el botón secundario
   "Descargar Excel primero". Tocar fuera cancela sin hacer nada.
3. **Eliminar la cuenta:** cada negocio del que es dueño tiene "Descargar el Excel" y la
   fecha de la última descarga (`lastExportedAt` de `deletion-preview`).

### `useDialog().confirm` acepta `onCancel`

Es lo que hace el botón secundario. Si no se pasa, sigue cerrando sin más.

## Pendiente

- Descargar un negocio ya cerrado: el backend lo permite y `ownedBusinesses` del dashboard
  lo trae con `inactivatedAt`, pero la app no lo muestra en ningún lado.
