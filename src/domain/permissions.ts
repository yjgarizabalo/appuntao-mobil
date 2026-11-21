/**
 * Qué puede hacer cada rol dentro de un negocio.
 *
 * Es el **espejo en el cliente** de la autorización del backend: cada acción
 * lista los mismos roles que su endpoint declara con `@BusinessRoles(...)`.
 * Sirve para decidir en la UI qué ocultar o deshabilitar **antes** de que el
 * usuario toque algo, en vez de dejarlo intentar y recibir un 403 seco. El
 * backend sigue siendo la última palabra; esto solo evita el viaje perdido.
 *
 * Si el backend cambia los roles de un endpoint, hay que actualizarlo aquí
 * también (esta tabla no se sincroniza sola).
 */
import type { BusinessRole } from './constants';

/** Acciones sensibles a rol que la app puede disparar. */
export type BusinessAction =
  | 'debtor:create' // POST /debtors
  | 'debtor:edit' // PATCH /debtors/:id (editar / inactivar)
  | 'debt:create' // POST /debts
  | 'debt:changeStatus' // PATCH /debts/:id/status
  | 'payment:create' // POST /payments y /payments/global
  | 'payment:reverse' // POST /payments/global/reverse/:groupId
  | 'member:invite' // POST /invitations (equipo)
  | 'client:invite' // POST /invitations (cliente, tipo DEBTOR), reenviar y cancelar
  | 'client:unlink' // PATCH /debtors/:id/unlink
  | 'member:manage' // POST/PATCH /business-users
  | 'member:remove'; // DELETE /business-users/:id

/** Roles permitidos por acción, calcados de `@BusinessRoles` en el backend. */
const ACTION_ROLES: Record<BusinessAction, readonly BusinessRole[]> = {
  'debtor:create': ['OWNER', 'ADMIN', 'CASHIER'],
  'debtor:edit': ['OWNER', 'ADMIN'],
  'debt:create': ['OWNER', 'ADMIN', 'CASHIER'],
  'debt:changeStatus': ['OWNER', 'ADMIN', 'CASHIER'],
  'payment:create': ['OWNER', 'ADMIN', 'CASHIER'],
  'payment:reverse': ['OWNER', 'ADMIN'],
  'member:invite': ['OWNER', 'ADMIN'],
  // El cajero atiende a los clientes en el mostrador: puede invitarlos, pero
  // no al equipo (el backend lo rechaza con 403).
  'client:invite': ['OWNER', 'ADMIN', 'CASHIER'],
  'client:unlink': ['OWNER', 'ADMIN'],
  'member:manage': ['OWNER', 'ADMIN'],
  'member:remove': ['OWNER'],
};

/**
 * ¿Puede este rol ejecutar la acción?
 *
 * Un rol **desconocido** (`null`/`undefined`) devuelve `true` a propósito:
 * pasa mientras el rol aún se está cargando, o si el backend no lo devolvió.
 * Bloquear a un dueño legítimo por un fetch lento —el backend gratuito de
 * Render se duerme— es peor que mostrar un botón que, en el caso rarísimo de
 * no tener permiso, el servidor negará con su 403. La app es preventiva, no la
 * guardiana final.
 */
export const can = (
  role: BusinessRole | null | undefined,
  action: BusinessAction,
): boolean => {
  if (role == null) return true;
  return ACTION_ROLES[action].includes(role);
};
