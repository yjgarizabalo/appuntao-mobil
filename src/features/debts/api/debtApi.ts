/**
 * API de deudas. `POST /debts` · `PATCH /debts/:id/status`
 *
 * Las deudas de un cliente no se piden aquí: llegan todas, con sus pagos, en
 * el detalle del cliente (`debtorApi.getDetail`). `GET /debtors/:id/debts`
 * pagina de 10 en 10 y con él el saldo salía incompleto.
 */
import { businessHeader, http } from '@/core/http/client';
import { toItem } from '@/core/http/payload';
import { mapDebt } from '@/domain/mappers';
import type { Debt, DebtDraft } from '@/domain/models';

export const debtApi = {
  /**
   * `POST /debts`
   *
   * El backend valida con `forbidNonWhitelisted`, así que el cuerpo se arma
   * campo por campo: una clave de más devuelve 400. Los opcionales vacíos se
   * omiten en lugar de mandarse como `''`. Rechaza (400) un cliente quitado,
   * un monto que no sea mayor que cero y un vencimiento en el pasado.
   */
  create: async (businessId: string, draft: DebtDraft): Promise<Debt> => {
    const { data } = await http.post(
      '/debts',
      {
        debtorId: draft.debtorId,
        amount: draft.amount,
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      },
      businessHeader(businessId),
    );
    return mapDebt(toItem(data), businessId);
  },

  /**
   * `PATCH /debts/:id/status` con `CANCELLED` — anular una deuda mal
   * registrada. Es el único cambio de estado manual: abonada y pagada salen
   * de los pagos.
   *
   * Solo dueño y administrador (al cajero, 403), y solo una deuda sin abonos
   * (si tiene, 400). No se puede deshacer: la anulada queda en el historial
   * pero ya no se cobra.
   */
  cancel: async (debtId: string, businessId: string): Promise<Debt> => {
    const { data } = await http.patch(
      `/debts/${debtId}/status`,
      { status: 'CANCELLED' },
      businessHeader(businessId),
    );
    return mapDebt(toItem(data), businessId);
  },
};
