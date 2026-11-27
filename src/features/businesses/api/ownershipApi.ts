/**
 * API de transferencia de la propiedad de un negocio.
 *
 * El dueño **propone** pasarle el negocio a un miembro (confirmando con su
 * contraseña) y el miembro **acepta o rechaza** dentro del plazo. Al aceptar,
 * el miembro queda como dueño y el anterior como administrador. Solo puede
 * haber una propuesta vigente por negocio.
 *
 * Ninguna lleva `x-business-id`: el backend comprueba la propiedad por el id
 * de la ruta.
 */
import { http } from '@/core/http/client';
import { mapOwnershipTransfer, mapOwnershipTransfers } from '@/domain/mappers';
import type { OwnershipTransfer } from '@/domain/models';

export const ownershipApi = {
  /** `POST /business/:id/ownership-transfer` (solo el dueño). */
  request: async (
    businessId: string,
    toUserId: string,
    password: string,
  ): Promise<OwnershipTransfer | null> => {
    const { data } = await http.post(`/business/${businessId}/ownership-transfer`, {
      toUserId,
      password,
    });
    return mapOwnershipTransfer(data);
  },

  /** `GET /business/:id/ownership-transfer` — la vigente, o `null`. */
  pending: async (businessId: string): Promise<OwnershipTransfer | null> => {
    const { data } = await http.get(`/business/${businessId}/ownership-transfer`);
    return data ? mapOwnershipTransfer(data) : null;
  },

  /**
   * `GET /business/:id/ownership-transfers/history` — las últimas 3 ya
   * resueltas (aceptadas, rechazadas, vencidas o canceladas) en las que el
   * usuario participó, de la más reciente a la más antigua.
   */
  history: async (businessId: string): Promise<OwnershipTransfer[]> => {
    const { data } = await http.get(`/business/${businessId}/ownership-transfers/history`);
    return mapOwnershipTransfers(data);
  },

  /** `DELETE /business/:id/ownership-transfer` (solo el dueño). */
  cancel: async (businessId: string): Promise<void> => {
    await http.delete(`/business/${businessId}/ownership-transfer`);
  },

  /** `GET /business/ownership-transfers/incoming` — las que me toca responder. */
  incoming: async (): Promise<OwnershipTransfer[]> => {
    const { data } = await http.get('/business/ownership-transfers/incoming');
    return mapOwnershipTransfers(data);
  },

  /**
   * Quedarse con el negocio. Como al crearlo, se envían los ids de los
   * documentos vigentes para negocios que aceptó (`legalApi.forBusiness`): el
   * backend los exige si todavía no los había aceptado.
   */
  accept: async (transferId: string, acceptedLegalDocumentIds: string[]): Promise<string> => {
    const { data } = await http.post(`/business/ownership-transfers/${transferId}/accept`, {
      acceptedLegalDocumentIds,
    });
    return String(data?.message ?? '');
  },

  reject: async (transferId: string): Promise<void> => {
    await http.post(`/business/ownership-transfers/${transferId}/reject`, {});
  },
};
