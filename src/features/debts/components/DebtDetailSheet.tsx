/**
 * Detalle de una deuda concreta, con sus abonos.
 *
 * El extracto del cliente mezcla todo en una sola lista, que es como el
 * tendero lee la cuenta; pero cuando hay que resolver un reclamo ("yo le
 * aboné el sábado") hace falta abrir una deuda y ver qué se le ha pagado.
 *
 * Desde aquí también se abona a **esta** deuda (`POST /payments`), a
 * diferencia del botón de la pantalla, que reparte el pago entre todas
 * (`POST /payments/global`).
 *
 * Y se anula una deuda mal registrada, solo si no tiene abonos ni descuentos
 * vigentes: con abonos, anularla escondería plata que sí entró.
 *
 * El dueño y el administrador también corrigen desde aquí: hacen un descuento
 * (lo que se le perdona al cliente) y reversan un abono o un descuento mal
 * registrado. Nada se borra: el reverso queda en la lista y el movimiento
 * reversado se ve tachado.
 */
import { StyleSheet, View } from 'react-native';

import { formatDate, formatMoney, formatRelativeDate } from '@/core/utils/format';
import {
  DEBT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  TRANSACTION_TYPE_LABEL,
} from '@/domain/constants';
import { type Debt, type Payment, paymentEffect } from '@/domain/models';
import { Badge, Button, Divider, Sheet, Text } from '@/ui';
import { theme } from '@/theme';

export interface DebtDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  /** `null` mientras no hay ninguna seleccionada. */
  debt: Debt | null;
  /** Abre el cobro de esta deuda. */
  onRegisterPayment: (debt: Debt) => void;
  /**
   * Pide anular esta deuda. Sin él (el cajero no puede anular) no se muestra
   * la opción.
   */
  onCancelDebt?: (debt: Debt) => void;
  /** Abre el descuento de esta deuda. Sin él (cajero) no se muestra. */
  onDiscount?: (debt: Debt) => void;
  /**
   * Pide reversar un abono o un descuento. Sin él (cajero) no se muestra. Si
   * el abono es parte de un pago global, quien lo recibe reversa el grupo.
   */
  onReversePayment?: (payment: Payment) => void;
}

export const DebtDetailSheet = ({
  visible,
  onClose,
  debt,
  onRegisterPayment,
  onCancelDebt,
  onDiscount,
  onReversePayment,
}: DebtDetailSheetProps) => {
  if (!debt) return null;

  // Solo cuenta lo vigente: un abono o descuento reversado ya no cuenta.
  const live = debt.payments.filter((payment) => !paymentEffect(payment).isReversed);
  const paid = live.reduce(
    (total, payment) => (payment.type === 'PAYMENT' ? total + payment.amount : total),
    0,
  );
  const discounted = live.reduce(
    (total, payment) => (payment.type === 'DISCOUNT' ? total + payment.amount : total),
    0,
  );
  const isOpen = debt.status !== 'PAID' && debt.status !== 'CANCELLED';
  const isCancelled = debt.status === 'CANCELLED';
  // Lo mismo que exige el backend: sin abonos y sin ningún otro movimiento.
  const canCancel =
    onCancelDebt !== undefined &&
    debt.status === 'OPEN' &&
    !debt.payments.some((payment) => paymentEffect(payment).canBeReversed);
  const isOverdue =
    isOpen && debt.dueDate.length > 0 && new Date(debt.dueDate).getTime() < Date.now();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={debt.description || 'Deuda'}
      // Sin límite de líneas: esta hoja es justo donde un nombre truncado con
      // puntos suspensivos en el extracto (`MovementRow`) se lee completo.
      titleNumberOfLines={0}
      subtitle={`Fiada el ${formatDate(debt.createdAt ?? debt.dueDate)}`}
      scrollable
      footer={
        isOpen ? (
          <View style={styles.footer}>
            <Button
              label="Abonar a esta deuda"
              icon="cash-outline"
              onPress={() => onRegisterPayment(debt)}
              size="lg"
              fullWidth
            />
            {onDiscount ? (
              <Button
                label="Hacer un descuento"
                icon="pricetag-outline"
                variant="ghost"
                onPress={() => onDiscount(debt)}
                fullWidth
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      {/* Saldo de esta deuda: es el dato por el que se abre la hoja. */}
      <View style={[styles.balanceCard, isOpen ? null : styles.balanceCardSettled]}>
        <Text variant="overline" color="textSubtle">
          {isOpen ? 'Falta por pagar' : isCancelled ? 'Anulada: no se cobra' : 'Esta deuda ya no suma'}
        </Text>
        <Text variant="title2" color={isOpen ? 'dangerStrong' : 'brandStrong'}>
          {formatMoney(debt.remainingAmount)}
        </Text>

        <View style={styles.badges}>
          <Badge
            label={DEBT_STATUS_LABEL[debt.status]}
            tone={
              debt.status === 'PAID'
                ? 'success'
                : debt.status === 'CANCELLED'
                  ? 'neutral'
                  : 'warning'
            }
          />
          {isOverdue ? (
            <Badge
              label={`Venció ${formatRelativeDate(debt.dueDate).toLowerCase()}`}
              tone="danger"
              icon="time-outline"
            />
          ) : null}
        </View>
      </View>

      <Row label="Total fiado" value={formatMoney(debt.amount)} />
      <Row label="Total abonado" value={`− ${formatMoney(paid)}`} tone="brandStrong" />
      {discounted > 0 ? (
        <Row label="Descuentos" value={`− ${formatMoney(discounted)}`} tone="brandStrong" />
      ) : null}
      {debt.dueDate ? <Row label="Vence" value={formatDate(debt.dueDate)} /> : null}

      <View style={styles.paymentsHeader}>
        <Text variant="captionStrong" color="textMuted">
          {debt.payments.length === 0
            ? 'Sin abonos todavía'
            : `Movimientos (${debt.payments.length})`}
        </Text>
      </View>

      {debt.payments.map((payment, index) => {
        const effect = paymentEffect(payment);
        const raises = effect.sign > 0;
        return (
          <View key={payment.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.payment}>
              <View style={styles.paymentBody}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {payment.type === 'PAYMENT'
                    ? `${PAYMENT_METHOD_LABEL[payment.method]}${payment.paymentGroupId ? ' · pago global' : ''}`
                    : TRANSACTION_TYPE_LABEL[payment.type]}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={2}>
                  {[formatRelativeDate(payment.createdAt), payment.note]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {effect.isReversed ? (
                  <Badge label="Reversado" tone="neutral" style={styles.reversedBadge} />
                ) : null}
              </View>
              <View style={styles.paymentSide}>
                <Text
                  variant="money"
                  color={effect.isReversed ? 'textMuted' : raises ? 'dangerStrong' : 'brandStrong'}
                  style={effect.isReversed ? styles.reversedAmount : undefined}
                >
                  {raises ? '+' : '−'} {formatMoney(payment.amount)}
                </Text>
                {onReversePayment && effect.canBeReversed && !isCancelled ? (
                  <Button
                    label={payment.paymentGroupId ? 'Reversar pago global' : 'Reversar'}
                    icon="arrow-undo-outline"
                    variant="ghost"
                    size="sm"
                    onPress={() => onReversePayment(payment)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {canCancel ? (
        <View style={styles.cancelSection}>
          <Text variant="caption" color="textMuted">
            ¿La registraste por error? Anúlala y, si hace falta, fía de nuevo el valor correcto.
          </Text>
          <Button
            label="Anular deuda"
            icon="close-circle-outline"
            variant="ghost"
            onPress={() => onCancelDebt(debt)}
            fullWidth
          />
        </View>
      ) : null}
    </Sheet>
  );
};

interface RowProps {
  label: string;
  value: string;
  tone?: 'text' | 'brandStrong';
}

const Row = ({ label, value, tone = 'text' }: RowProps) => (
  <View style={styles.row}>
    <Text variant="body" color="textMuted">
      {label}
    </Text>
    <Text variant="bodyStrong" color={tone}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  balanceCard: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  balanceCardSettled: {
    backgroundColor: theme.color.brandSoft,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  paymentsHeader: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  paymentBody: {
    flex: 1,
    gap: 2,
  },
  paymentSide: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  reversedAmount: {
    textDecorationLine: 'line-through',
  },
  reversedBadge: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
  },
  footer: {
    gap: theme.spacing.xs,
  },
  cancelSection: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
});
