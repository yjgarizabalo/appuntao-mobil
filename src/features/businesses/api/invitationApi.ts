/**
 * API de invitaciones (`/invitations`).
 *
 * Una invitación va dirigida a un **correo o teléfono**, y solo la puede
 * aceptar la persona cuya cuenta tenga ese dato. Hay dos tipos:
 *
 *  - `BUSINESS_USER`: entrar al equipo del negocio con un rol;
 *  - `DEBTOR`: vincular la cuenta a una ficha de cliente para ver lo que debe.
 *    Es la única forma de crear ese vínculo: el backend ya no vincula solo al
 *    registrarse.
 *
 * **Lado del negocio** (dueño o administrador, con `x-business-id`): crear,
 * listar, reenviar y cancelar. Crear y reenviar devuelven el texto y el enlace
 * de WhatsApp listos para compartir.
 *
 * **Lado de la persona invitada** (solo autenticada): ver las que le llegaron
 * (`incoming`), ver una por su código, aceptarla o rechazarla. En esa vista el
 * backend no devuelve el código ni el contacto.
 */
import { businessHeader, http } from '@/core/http/client';
import { toItem, toList, toPage } from '@/core/http/payload';
import type { BusinessRole, InvitationStatus, InvitationType } from '@/domain/constants';
import { mapInvitation, mapInvitationShare } from '@/domain/mappers';
import type { Invitation, InvitationShare } from '@/domain/models';

export interface InviteDraft {
  email?: string;
  phone?: string;
  role: BusinessRole;
}

export interface ClientInviteDraft {
  debtorId: string;
  /** Si no se indica ni teléfono ni correo, el backend usa el teléfono de la ficha. */
  phone?: string;
  email?: string;
}

/** Resultado de aceptar: el negocio y el tipo, para saber a dónde llevar al usuario. */
export interface AcceptedInvitation {
  message: string;
  businessId: string;
  type: InvitationType;
}

/** Las invitaciones vivas de un negocio son pocas; una página de 100 sobra. */
const MAX_INVITATIONS = 100;

/** El backend normaliza igual, pero así lo que se muestra es lo que se manda. */
export const normalizeInvitationCode = (code: string): string =>
  code.replace(/[\s-]/g, '').toUpperCase();

const toAccepted = (data: unknown): AcceptedInvitation => {
  const body = (data ?? {}) as Record<string, unknown>;
  return {
    message: String(body.message ?? ''),
    businessId: String(body.businessId ?? ''),
    type: body.type === 'BUSINESS_USER' ? 'BUSINESS_USER' : 'DEBTOR',
  };
};

export const invitationApi = {
  /* ── Lado del negocio ──────────────────────────────────────────────────── */

  /** `POST /invitations` — invitar al equipo con un rol. */
  create: async (businessId: string, draft: InviteDraft): Promise<InvitationShare> => {
    const { data } = await http.post(
      '/invitations',
      { type: 'BUSINESS_USER', email: draft.email, phone: draft.phone, role: draft.role },
      businessHeader(businessId),
    );
    return mapInvitationShare(data);
  },

  /** `POST /invitations` — invitar a un cliente a ver su cuenta (`DEBTOR`). */
  inviteClient: async (
    businessId: string,
    draft: ClientInviteDraft,
  ): Promise<InvitationShare> => {
    const { data } = await http.post(
      '/invitations',
      {
        type: 'DEBTOR',
        debtorId: draft.debtorId,
        phone: draft.phone || undefined,
        email: draft.email || undefined,
      },
      businessHeader(businessId),
    );
    return mapInvitationShare(data);
  },

  /** `GET /invitations` — invitaciones del negocio, con filtros opcionales. */
  listByBusiness: async (
    businessId: string,
    filters: { status?: InvitationStatus; type?: InvitationType } = {},
  ): Promise<Invitation[]> => {
    const { data } = await http.get('/invitations', {
      params: { page: 1, limit: MAX_INVITATIONS, ...filters },
      ...businessHeader(businessId),
    });
    return toPage<unknown>(data, 1, MAX_INVITATIONS).items.map(mapInvitation);
  },

  /** `POST /invitations/:id/resend` — renueva la vigencia; el código no cambia. */
  resend: async (businessId: string, invitationId: string): Promise<InvitationShare> => {
    const { data } = await http.post(
      `/invitations/${invitationId}/resend`,
      {},
      businessHeader(businessId),
    );
    return mapInvitationShare(data);
  },

  /** `DELETE /invitations/:id` — cancela una pendiente. */
  cancel: async (businessId: string, invitationId: string): Promise<void> => {
    await http.delete(`/invitations/${invitationId}`, businessHeader(businessId));
  },

  /* ── Lado de la persona invitada ───────────────────────────────────────── */

  /** `GET /invitations/incoming` — las pendientes dirigidas a mi correo o teléfono. */
  incoming: async (): Promise<Invitation[]> => {
    const { data } = await http.get('/invitations/incoming');
    return toList<unknown>(data).map(mapInvitation);
  },

  /** `GET /invitations/:code` — vista previa, solo si la invitación es para mí. */
  getByCode: async (code: string): Promise<Invitation> => {
    const { data } = await http.get(
      `/invitations/${encodeURIComponent(normalizeInvitationCode(code))}`,
    );
    return mapInvitation(toItem(data));
  },

  /** `POST /invitations/accept` — aceptar con el código. */
  acceptByCode: async (code: string): Promise<AcceptedInvitation> => {
    const { data } = await http.post('/invitations/accept', {
      code: normalizeInvitationCode(code),
    });
    return toAccepted(data);
  },

  /** `POST /invitations/:id/accept` — aceptar una que aparece en la app. */
  acceptById: async (invitationId: string): Promise<AcceptedInvitation> => {
    const { data } = await http.post(`/invitations/${invitationId}/accept`, {});
    return toAccepted(data);
  },

  /** `POST /invitations/:id/reject` */
  reject: async (invitationId: string): Promise<void> => {
    await http.post(`/invitations/${invitationId}/reject`, {});
  },
};
