/**
 * Aviso de "perdí el acceso a un negocio".
 *
 * Cuando una petición con `x-business-id` responde 403, lo más probable es
 * que lo que la app sabe del negocio ya no sea cierto: sacaron al usuario del
 * equipo, le cambiaron el rol o el negocio cambió de dueño. El cliente HTTP lo
 * avisa por aquí y `BusinessProvider` vuelve a pedir los negocios, sin que
 * cada pantalla tenga que acordarse.
 *
 * Vive en `core` porque lo dispara el cliente HTTP; quien escucha es la capa
 * de `features`, que sí sabe qué hacer con eso.
 */
type BusinessForbiddenListener = (businessId: string) => void;

const listeners = new Set<BusinessForbiddenListener>();

export const onBusinessForbidden = (listener: BusinessForbiddenListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyBusinessForbidden = (businessId: string): void => {
  listeners.forEach((listener) => listener(businessId));
};
