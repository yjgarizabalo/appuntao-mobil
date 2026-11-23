/**
 * Fila del extracto de movimientos.
 *
 * Una deuda y un pago se distinguen sin leer: icono y color opuestos, y el
 * signo del importe (`+` lo que sube el saldo, `−` lo que lo baja). Así el
 * extracto se escanea como el cuaderno que reemplaza.
 *
 * Además del abono están el descuento (baja el saldo, icono de etiqueta) y el
 * reverso (lo sube, flecha de deshacer). Un abono o descuento reversado sigue
 * en el historial, atenuado y con la marca "Reversado".
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatMoney, formatRelativeDate } from '@/core/utils/format';
import { DEBT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '@/domain/constants';
import { type Movement, paymentEffect } from '@/domain/models';
import { Badge, PressableScale, Text } from '@/ui';
import { theme } from '@/theme';

export interface MovementRowProps {
  movement: Movement;
  /** Abre la hoja de la deuda (en un pago, la deuda a la que se aplicó). */
  onPress?: () => void;
}

type Look = {
  title: string;
  icon: 'arrow-up' | 'arrow-down' | 'pricetag-outline' | 'arrow-undo';
  /** `+` sube lo que se debe; `−` lo baja. */
  sign: '+' | '−';
  tone: 'danger' | 'brand';
};

const lookOf = (movement: Movement): Look => {
  if (movement.kind === 'debt') {
    return {
      title: movement.debt.description || 'Deuda',
      icon: 'arrow-up',
      sign: '+',
      tone: 'danger',
    };
  }
  const { payment } = movement;
  if (payment.type === 'DISCOUNT') {
    return { title: 'Descuento', icon: 'pricetag-outline', sign: '−', tone: 'brand' };
  }
  if (payment.type === 'REVERSAL') {
    return { title: 'Reverso', icon: 'arrow-undo', sign: '+', tone: 'danger' };
  }
  return {
    title: payment.paymentGroupId
      ? `Pago en ${PAYMENT_METHOD_LABEL[payment.method].toLowerCase()} (repartido)`
      : `Pago en ${PAYMENT_METHOD_LABEL[payment.method].toLowerCase()}`,
    icon: 'arrow-down',
    sign: '−',
    tone: 'brand',
  };
};

export const MovementRow = ({ movement, onPress }: MovementRowProps) => {
  const isDebt = movement.kind === 'debt';
  const look = lookOf(movement);
  const { title } = look;
  const isReversed = movement.kind === 'payment' && paymentEffect(movement.payment).isReversed;
  const isDanger = look.tone === 'danger';

  const subtitle = isDebt
    ? formatRelativeDate(movement.debt.createdAt ?? movement.debt.dueDate)
    : [formatRelativeDate(movement.payment.createdAt), movement.payment.note]
        .filter(Boolean)
        .join(' · ');

  const content = (
    <>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: isReversed
              ? theme.color.surfaceSunken
              : isDanger
                ? theme.color.dangerSoft
                : theme.color.brandSoft,
          },
        ]}
      >
        <Ionicons
          name={look.icon}
          size={17}
          color={
            isReversed
              ? theme.color.textMuted
              : isDanger
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

      <View style={styles.amount}>
        <Text
          variant="money"
          color={isReversed ? 'textMuted' : isDanger ? 'dangerStrong' : 'brandStrong'}
          numberOfLines={1}
          style={isReversed ? styles.reversedAmount : undefined}
        >
          {look.sign}
          {formatMoney(movement.amount)}
        </Text>

        {isReversed ? <Badge label="Reversado" tone="neutral" /> : null}

        {isDebt && movement.debt.status !== 'OPEN' ? (
          <Badge
            label={DEBT_STATUS_LABEL[movement.debt.status]}
            tone={
              movement.debt.status === 'PAID'
                ? 'success'
                : movement.debt.status === 'CANCELLED'
                  ? 'neutral'
                  : 'warning'
            }
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) return <View style={styles.container}>{content}</View>;

  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={`Ver el detalle de ${title}`}
      style={styles.container}
    >
      {content}
    </PressableScale>
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
  amount: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  reversedAmount: {
    textDecorationLine: 'line-through',
  },
});
