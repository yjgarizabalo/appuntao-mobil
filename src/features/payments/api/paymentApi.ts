/**
 * API de pagos.
 *
 * Abonar:
 *  - `POST /payments` abona a **una** deuda concreta;
 *  - `POST /payments/global` abona al **saldo total** del cliente y el backend
 *    reparte el monto entre sus deudas abiertas, de la más antigua a la más
 *    nueva, devolviendo el total del grupo en `group.totalAmount`.
 *
 * Corregir (dueño y administrador):
 *  - `POST /payments/discounts`: descuento, con motivo;
 *  - `POST /payments/:id/reverse`: reverso de un abono o descuento suelto;
 *  - `POST /payments/global/reverse/:groupId`: reverso de un pago global.
 *
 * Nada se edita ni se borra: cada corrección es un movimiento nuevo que queda
 * en el historial.
 */
import { businessHeader, http } from '@/core/http/client';
import { DEFAULT_PAGE_SIZE, type Page, toAmount, toItem, toPage } from '@/core/http/payload';
import { mapPayment } from '@/domain/mappers';
import type { GlobalPaymentDraft, Payment, PaymentDraft } from '@/domain/models';

export interface GlobalPaymentResult {
  /** Monto efectivamente aplicado por el backend. */
  totalAmount: number;
  /** Cuántas deudas alcanzó a cubrir el reparto. */
  debtsAffected: number;
}

export const paymentApi = {
  /** `POST /payments` — abono a una deuda puntual. */
  create: async (businessId: string, draft: PaymentDraft): Promise<Payment> => {
    const { data } = await http.post(
      '/payments',
      {
        debtId: draft.debtId,
        amount: draft.amount,
        method: draft.method,
        ...(draft.note ? { note: draft.note } : {}),
      },
      businessHeader(businessId),
    );
    return mapPayment(toItem(data), draft.debtId);
  },

  /**
   * `POST /payments/discounts` — descuento: baja el saldo de una deuda sin
   * que entre plata. Motivo obligatorio (3 a 200 caracteres) y nunca más que
   * el saldo.
   */
  createDiscount: async (
    businessId: string,
    draft: { debtId: string; amount: number; reason: string },
  ): Promise<Payment> => {
    const { data } = await http.post(
      '/payments/discounts',
      { debtId: draft.debtId, amount: draft.amount, reason: draft.reason },
      businessHeader(businessId),
    );
    return mapPayment(toItem(data), draft.debtId);
  },

  /**
   * `POST /payments/:id/reverse` — deshace un abono o un descuento suelto con
   * un reverso por el mismo valor. Una sola vez por movimiento. Si es parte de
   * un pago global responde 400 `PAYMENT_IN_GROUP`: va por `reverseGlobal`.
   */
  reverse: async (businessId: string, paymentId: string): Promise<Payment> => {
    const { data } = await http.post(
      `/payments/${paymentId}/reverse`,
      {},
      businessHeader(businessId),
    );
    return mapPayment(toItem(data));
  },

  /** `POST /payments/global/reverse/:groupId` — deshace un pago global completo. */
  reverseGlobal: async (businessId: string, groupId: string): Promise<void> => {
    await http.post(`/payments/global/reverse/${groupId}`, {}, businessHeader(businessId));
  },

  /** `POST /payments/global` — abono al saldo total del cliente. */
  createGlobal: async (
    businessId: string,
    draft: GlobalPaymentDraft,
  ): Promise<GlobalPaymentResult> => {
    const { data } = await http.post(
      '/payments/global',
      {
        debtorId: draft.debtorId,
        amount: draft.amount,
        method: draft.method,
        ...(draft.note ? { note: draft.note } : {}),
      },
      businessHeader(businessId),
    );

    // El servicio responde `{ group: { totalAmount }, summary: { debtsAffected } }`.
    // Si cambiara la forma, se cae al monto solicitado en lugar de mostrar 0.
    const body = data as
      | { group?: { totalAmount?: unknown }; summary?: { debtsAffected?: unknown } }
      | undefined;
    const groupTotal = body?.group?.totalAmount;

    return {
      totalAmount: groupTotal === undefined ? draft.amount : toAmount(groupTotal),
      debtsAffected: toAmount(body?.summary?.debtsAffected),
    };
  },

  /**
   * `GET /debts/:debtId/payments` — pagos de una deuda.
   *
   * Hoy el detalle del cliente no lo necesita (las deudas ya llegan con sus
   * pagos), pero se mantiene porque el endpoint es el único que pagina los
   * pagos y sirve para un histórico largo.
   */
  listByDebt: async (
    debtId: string,
    businessId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<Page<Payment>> => {
    const { data } = await http.get(`/debts/${debtId}/payments`, {
      params: { page, limit, type: 'PAYMENT' },
      ...businessHeader(businessId),
    });
    const raw = toPage<unknown>(data, page, limit);
    return { items: raw.items.map((item) => mapPayment(item, debtId)), meta: raw.meta };
  },
};
