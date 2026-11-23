/**
 * API de miembros de un negocio. `GET/PATCH/DELETE /business-users`.
 *
 * Todos exigen el header `x-business-id`. El alta de un miembro por `userId`
 * (`POST /business-users`) no se expone aquí a propósito: la app no tiene forma
 * de conocer el `userId` de otra persona, así que sumar gente se hace por
 * invitación (ver `invitationApi`), no por alta directa.
 */
import { businessHeader, http } from '@/core/http/client';
import { toItem, toPage } from '@/core/http/payload';
import type { BusinessRole } from '@/domain/constants';
import { mapMember } from '@/domain/mappers';
import type { Member } from '@/domain/models';

/** Un negocio tiene un puñado de miembros; una página de 100 los cubre todos. */
const MAX_MEMBERS = 100;

export const memberApi = {
  /** `GET /business-users` — miembros del negocio (cualquier rol puede verlos). */
  listByBusiness: async (businessId: string): Promise<Member[]> => {
    const { data } = await http.get('/business-users', {
      params: { page: 1, limit: MAX_MEMBERS },
      ...businessHeader(businessId),
    });
    return toPage<unknown>(data, 1, MAX_MEMBERS).items.map(mapMember);
  },

  /**
   * `PATCH /business-users/:id` — cambia el rol de un miembro. Ver
   * `manageableRoles` para quién puede pasar a quién a qué rol.
   */
  updateRole: async (
    businessId: string,
    memberId: string,
    role: BusinessRole,
  ): Promise<Member> => {
    const { data } = await http.patch(
      `/business-users/${memberId}`,
      { role },
      businessHeader(businessId),
    );
    return mapMember(toItem(data));
  },

  /**
   * `DELETE /business-users/:id` — saca a un miembro del negocio. El dueño
   * saca a cualquiera; el administrador, a cajeros y solo lectura.
   */
  remove: async (businessId: string, memberId: string): Promise<void> => {
    await http.delete(`/business-users/${memberId}`, businessHeader(businessId));
  },

  /** `DELETE /business-users/me` — salirse del negocio. El dueño no puede. */
  leave: async (businessId: string): Promise<void> => {
    await http.delete('/business-users/me', businessHeader(businessId));
  },
};
