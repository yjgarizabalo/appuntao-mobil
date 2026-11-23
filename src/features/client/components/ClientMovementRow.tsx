/**
 * Fila del extracto del cliente.
 *
 * Es prima de `MovementRow` del modo tendero —mismo código visual: rojo y
 * flecha arriba para lo que le fiaron, verde y flecha abajo para lo que
 * abonó— pero vive aquí por dos razones: el extracto del cliente cruza varias
 * tiendas y necesita decir **en cuál** pasó cada movimiento, y las features no
 * se importan entre sí (comparten a través de `domain` y `ui`).
 *
 * El texto está escrito desde el lado del cliente: "Te fiaron" y "Abonaste",
 * no "Deuda" y "Pago". El descuento es "Te descontaron" y el reverso de un
 * abono "Se reversó un abono"; el abono reversado se ve atenuado y tachado.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatMoney, formatRelativeDate } from '@/core/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/domain/constants';
import { type ClientMovement, paymentEffect } from '@/domain/models';
import { Text } from '@/ui';
import { theme } from '@/theme';

export interface ClientMovementRowProps {
  row: ClientMovement;
  /** Oculta el nombre de la tienda: dentro de una tienda ya se sabe cuál es. */
  hideStore?: boolean;
}

export const ClientMovementRow = ({ row, hideStore = false }: ClientMovementRowProps) => {
  const { movement } = row;
  const isDebt = movement.kind === 'debt';
  const payment = movement.kind === 'payment' ? movement.payment : null;
  const isReversal = payment?.type === 'REVERSAL';
  const isReversed = payment !== null && paymentEffect(payment).isReversed;
  // Lo que sube el saldo (lo fiado y los reversos) va en rojo con `+`.
  const raises = isDebt || isReversal;

  const title = isDebt
    ? movement.debt.description || 'Te fiaron'
    : payment?.type === 'DISCOUNT'
      ? 'Te descontaron'
      : isReversal
        ? 'Se reversó un abono'
        : `Abonaste en ${PAYMENT_METHOD_LABEL[movement.payment.method].toLowerCase()}`;

  const date = isDebt
    ? formatRelativeDate(movement.debt.createdAt ?? movement.debt.dueDate)
    : formatRelativeDate(movement.payment.createdAt);

  const subtitle = [hideStore ? null : row.businessName, date].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: isReversed
              ? theme.color.surfaceSunken
              : raises
                ? theme.color.dangerSoft
                : theme.color.brandSoft,
          },
        ]}
      >
        <Ionicons
          name={
            isDebt
              ? 'arrow-up'
              : isReversal
                ? 'arrow-undo'
                : payment?.type === 'DISCOUNT'
                  ? 'pricetag-outline'
                  : 'arrow-down'
          }
          size={17}
          color={
            isReversed
              ? theme.color.textMuted
              : raises
                ? theme.color.dangerStrong
                : theme.color.brandStrong
          }
        />
      </View>

      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Text
        variant="money"
        color={isReversed ? 'textMuted' : raises ? 'dangerStrong' : 'brandStrong'}
        numberOfLines={1}
        style={isReversed ? styles.reversedAmount : undefined}
      >
        {raises ? '+' : '−'}
        {formatMoney(movement.amount)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  reversedAmount: {
    textDecorationLine: 'line-through',
  },
});
