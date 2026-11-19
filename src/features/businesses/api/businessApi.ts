/**
 * API de negocios. `GET/POST /business`, `PATCH /business/:id/inactivate`.
 */
import { http } from '@/core/http/client';
import { DEFAULT_PAGE_SIZE, type Page, toItem, toPage } from '@/core/http/payload';
import { mapBusiness } from '@/domain/mappers';
import type { Business, BusinessDraft } from '@/domain/models';

/** Tope que acepta el backend en `limit` (PaginationDto lo valida con `@Max(100)`). */
const MAX_PAGE_SIZE = 100;
/** Freno de seguridad: 50 páginas son 5000 negocios, muy por encima de lo real. */
const MAX_PAGES = 50;

export const businessApi = {
  list: async (page = 1, limit = DEFAULT_PAGE_SIZE): Promise<Page<Business>> => {
    const { data } = await http.get('/business', { params: { page, limit } });
    const raw = toPage<unknown>(data, page, limit);
    return { items: raw.items.map(mapBusiness), meta: raw.meta };
  },

  /**
   * Todos los negocios del usuario, recorriendo las páginas que haga falta.
   *
   * El provider necesita la lista **completa**, no una página: `getBusiness()`
   * resuelve nombres de negocios que aparecen en la lista de clientes y el
   * selector los ofrece todos. Antes se pedía una sola página de 50 y el
   * negocio 51 simplemente no existía para la app, sin ningún aviso.
   *
   * En la práctica es una sola petición: un tendero tiene entre 1 y 5.
   */
  listAll: async (): Promise<Business[]> => {
    const first = await businessApi.list(1, MAX_PAGE_SIZE);
    const all = [...first.items];

    for (let page = 2; page <= first.meta.totalPages && page <= MAX_PAGES; page += 1) {
      const next = await businessApi.list(page, MAX_PAGE_SIZE);
      all.push(...next.items);
    }

    return all;
  },

  create: async (draft: BusinessDraft): Promise<Business> => {
    const { data } = await http.post('/business', draft);
    return mapBusiness(toItem(data));
  },

  /**
   * `PATCH /business/:id/inactivate` — cierra el negocio (solo el dueño, y
   * sin deudas por cobrar). Sus datos se eliminan pasado el plazo de
   * retención; devuelve esa fecha (ISO).
   */
  close: async (businessId: string): Promise<{ message: string; dataDeletionScheduledAt: string }> => {
    const { data } = await http.patch(`/business/${businessId}/inactivate`, {});
    return {
      message: String(data?.message ?? ''),
      dataDeletionScheduledAt: String(data?.dataDeletionScheduledAt ?? ''),
    };
  },
};
