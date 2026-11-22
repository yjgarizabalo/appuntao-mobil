/**
 * API de clientes (deudores).
 *
 * Todos los endpoints salvo `/debtors/me/all` exigen el header
 * `x-business-id`: el backend es multi-tenant por negocio.
 */
import { businessHeader, http } from '@/core/http/client';
import { DEFAULT_PAGE_SIZE, type Page, toItem, toPage } from '@/core/http/payload';
import { mapBusinessSummary, mapDebt, mapDebtor } from '@/domain/mappers';
import type { BusinessSummary, Debt, Debtor, DebtorDraft } from '@/domain/models';

/**
 * Texto de búsqueda para el backend, que busca en nombre, celular y documento
 * sin distinguir mayúsculas (y el celular y el documento también solo con
 * dígitos). Se manda `undefined` cuando está vacío para no ensuciar la URL
 * con `search=`.
 */
const searchParam = (search?: string): string | undefined => {
  const trimmed = search?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

/** Filtros del listado que resuelve el servidor. */
export interface DebtorListQuery {
  search?: string;
  /** `true` solo con saldo, `false` solo al día, `undefined` todos. */
  hasDebt?: boolean;
}

/**
 * Tope de `top` para `/debtors/summary`. Es el mismo del backend, que responde
 * 400 si se pasa; se recorta aquí para no llegar a ese error.
 */
const MAX_SUMMARY_TOP = 50;

export const debtorApi = {
  /**
   * `GET /debtors` — clientes de un negocio concreto.
   *
   * La búsqueda va al servidor, no se filtra en el móvil: con paginación, un
   * filtro local solo miraría la página cargada y no encontraría al cliente
   * que está en la página 8.
   */
  listByBusiness: async (
    businessId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    query: DebtorListQuery = {},
  ): Promise<Page<Debtor>> => {
    const { data } = await http.get('/debtors', {
      params: { page, limit, search: searchParam(query.search), hasDebt: query.hasDebt },
      ...businessHeader(businessId),
    });
    const raw = toPage<unknown>(data, page, limit);
    // Este endpoint no devuelve `businessId`, así que se rellena aquí para que
    // la navegación al detalle pueda enviar el header correcto.
    return { items: raw.items.map((item) => mapDebtor(item, businessId)), meta: raw.meta };
  },

  /** `GET /debtors/me/all` — clientes de todos los negocios del usuario. */
  listAll: async (
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    query: DebtorListQuery = {},
  ): Promise<Page<Debtor>> => {
    const { data } = await http.get('/debtors/me/all', {
      params: { page, limit, search: searchParam(query.search), hasDebt: query.hasDebt },
    });
    const raw = toPage<unknown>(data, page, limit);
    return { items: raw.items.map((item) => mapDebtor(item)), meta: raw.meta };
  },

  /**
   * `GET /debtors/summary` — totales del negocio calculados por el servidor.
   *
   * Sustituye a "traer una página de clientes y sumar en el móvil", que daba
   * una cifra menor que la real en cuanto el negocio pasaba de 100 clientes.
   * Devuelve además el ranking de morosos ya ordenado en la base de datos.
   *
   * `top` se recorta a `MAX_SUMMARY_TOP` antes de llamar al backend: este es
   * el único punto de acceso al endpoint, así que ningún llamador necesita
   * repetir esa validación.
   */
  getSummary: async (businessId: string, top = 5): Promise<BusinessSummary> => {
    const validatedTop = Math.min(top, MAX_SUMMARY_TOP);
    const { data } = await http.get('/debtors/summary', {
      params: { top: validatedTop },
      ...businessHeader(businessId),
    });
    return mapBusinessSummary(toItem(data), businessId);
  },

  /** `GET /debtors/:id`, solo la ficha (para editarla). */
  getById: async (debtorId: string, businessId: string): Promise<Debtor> => {
    const { data } = await http.get(`/debtors/${debtorId}`, businessHeader(businessId));
    return mapDebtor(toItem(data), businessId);
  },

  /**
   * `GET /debtors/:id` — la ficha con su saldo y **todas** sus deudas con sus
   * pagos, sin paginar.
   *
   * El detalle se arma solo con esto. Antes pedía además
   * `/debtors/:id/debts`, que pagina de 10 en 10: con más de 10 deudas el
   * saldo, los totales y el extracto salían incompletos.
   */
  getDetail: async (
    debtorId: string,
    businessId: string,
  ): Promise<{ debtor: Debtor; debts: Debt[] }> => {
    const { data } = await http.get(`/debtors/${debtorId}`, businessHeader(businessId));
    const raw = toItem<{ debts?: unknown }>(data) ?? {};
    const debts = Array.isArray(raw.debts) ? raw.debts : [];
    return {
      debtor: mapDebtor(raw, businessId),
      debts: debts.map((item) => mapDebt(item, businessId)),
    };
  },

  /** `POST /debtors` */
  create: async (businessId: string, draft: DebtorDraft): Promise<Debtor> => {
    const { data } = await http.post('/debtors', draft, businessHeader(businessId));
    return mapDebtor(toItem(data), businessId);
  },

  /**
   * `PATCH /debtors/:id` — corrige los datos de un cliente.
   *
   * El backend acepta campos sueltos (el DTO es un `PartialType`), así que se
   * manda solo lo que cambió; si llega el tipo de documento sin el número (o
   * al revés), valida la pareja como queda guardada. Exige rol `ADMIN` u
   * `OWNER` en el negocio; el tendero que creó el negocio es `OWNER`, pero un
   * `CASHIER` recibirá un 403.
   *
   * Si el celular o el documento ya son de otro cliente del negocio responde
   * 409 `DEBTOR_DUPLICATE` con el campo en `errors`, igual que al crear.
   *
   * Ojo: el deudor **no** se puede editar si está inactivado; en ese caso el
   * backend responde 404, no un 409.
   */
  update: async (
    debtorId: string,
    businessId: string,
    changes: Partial<DebtorDraft>,
  ): Promise<Debtor> => {
    const { data } = await http.patch(
      `/debtors/${debtorId}`,
      changes,
      businessHeader(businessId),
    );
    return mapDebtor(toItem(data), businessId);
  },

  /**
   * `PATCH /debtors/:id/inactivate` — quita al cliente de la lista del negocio.
   *
   * Solo dueño y administrador, y solo si no debe nada (si no, 400). Sus
   * deudas y pagos se conservan; si estaba vinculado, la cuenta deja de verlo
   * y sus invitaciones pendientes se cancelan. **No se puede deshacer**: para
   * volver a tenerlo hay que registrarlo de nuevo.
   */
  inactivate: async (debtorId: string, businessId: string): Promise<void> => {
    await http.patch(`/debtors/${debtorId}/inactivate`, {}, businessHeader(businessId));
  },

  /**
   * `PATCH /debtors/:id/unlink` — la cuenta que veía la ficha deja de verla.
   * La ficha, sus deudas y sus pagos no cambian. Solo dueño y administrador.
   */
  unlink: async (debtorId: string, businessId: string): Promise<void> => {
    await http.patch(`/debtors/${debtorId}/unlink`, {}, businessHeader(businessId));
  },
};
