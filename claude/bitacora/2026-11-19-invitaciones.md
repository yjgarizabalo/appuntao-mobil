# 2026-11-19 — Invitaciones al equipo y a clientes

Rama `feature/invitations`, que sale de `dev`. Integra el rediseño del módulo de
invitaciones del backend (rama `feature/invitations` del backend, todavía no desplegada).

## Por qué

- El backend **dejó de vincular cuentas solas** con fichas de cliente por documento o
  teléfono: cualquier negocio podía "reclamar" a una persona registrando su número. Ahora
  la única forma de que un cliente vea su cuenta en el modo cliente es aceptar una
  invitación `DEBTOR` de la tienda, y la app no tenía cómo crearla.
- Una invitación va dirigida a un correo o teléfono, y solo la puede aceptar quien tenga
  ese dato en su cuenta. Le aparece al entrar (`GET /invitations/incoming`); la app no la
  mostraba, así que alguien recién registrado no tenía cómo enterarse.
- **"Tengo un código" estaba roto** contra el backend nuevo: aceptaba con el código que
  devolvía la vista previa, y el backend ya no lo incluye en la vista de la persona
  invitada. Se mandaba vacío.

## Qué cambió

### API y dominio

- `invitationApi`: crear (equipo y cliente), listar (`GET /invitations`, la ruta vieja
  quedó obsoleta), reenviar, cancelar, `incoming`, vista previa, aceptar por código o por
  id y rechazar. Crear y reenviar devuelven `InvitationShare`: invitación, `shareText`,
  `whatsappUrl` y `emailSent`.
- `Invitation` gana `businessName`, `debtorId`, `debtorName` e `invitedByName`. Los estados
  son los cinco del backend (`REJECTED` y `CANCELLED` faltaban).
- `Debtor.isLinked`: la ficha ya está vinculada a una cuenta.
- Permiso `client:invite` (dueño y administrador, igual que el backend).
- `features/businesses/model/invitationFlow.ts`: `shareInvitation` (WhatsApp, o la hoja de
  compartir) y `useFinishAcceptedInvitation` (refresca y lleva al modo que corresponde).

### Pantallas

- **`IncomingInvitationsCard`**: invitaciones recibidas, con Aceptar y Rechazar. Está en
  Inicio (también sin negocios, donde cae alguien recién registrado), Mis negocios y el
  modo cliente.
- **Detalle del cliente → `ClientAccessCard`**: "Ve su cuenta en Appuntao" si está
  vinculado; si hay invitación pendiente, a quién y hasta cuándo, con Reenviar y Cancelar;
  si no, "Invitar". Un cajero solo ve el estado vinculado.
- **`InviteClientScreen`** (`/client/invite`): WhatsApp con el celular de la ficha
  precargado, o correo. Si ya hay una pendiente, ofrece reenviarla.
- **Equipo**: tocar una invitación pendiente permite reenviarla o cancelarla. Invitar al
  equipo también ofrece reenviar si ya había una.
- **Tengo un código**: acepta con el código escrito, lo normaliza (mayúsculas, sin
  espacios ni guiones) y muestra el 403 de "es para otro teléfono o correo" junto al campo.
- El mensaje de WhatsApp del equipo y el modo cliente vacío explican el flujo nuevo: entrar
  con el mismo número, la invitación aparece sola, el código es el respaldo.

### Modo cliente: deudas con su propio endpoint (2026-11-20)

Al probar, entrar a una tienda en el modo cliente respondía 403 "El usuario no pertenece a
este negocio". `clientApi.getStanding` usaba la ruta del tendero (`/debtors/:id/debts` con
`x-business-id`), que exige ser del equipo; además paginaba de a 10. El backend agregó
`GET /debtors/me/:debtorId/debts`, que solo responde si la ficha es de la cuenta, y la app
lo usa.

### Cajero y desvincular (2026-11-21)

- **El cajero puede invitar clientes**, reenviar y cancelar esas invitaciones, pero no las
  del equipo (`client:invite` incluye `CASHIER`; `member:invite` no).
- **Desvincular desde el negocio:** en el detalle del cliente vinculado, "Desvincular"
  (dueño y administrador, `PATCH /debtors/:id/unlink`).
- **Desvincular desde el cliente:** en la tienda del modo cliente, "Dejar de ver esta
  tienda" (`DELETE /debtors/me/:debtorId/link`). La deuda no cambia y la tienda puede
  volver a invitarlo.
- Las dos quedan en la auditoría del backend como `DEBTOR_UNLINKED`.
