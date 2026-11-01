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
 * no "Deuda" y "Pago".
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatMoney, formatRelativeDate } from '@/core/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/domain/constants';
import type { ClientMovement } from '@/domain/models';
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

  const title = isDebt
    ? movement.debt.description || 'Te fiaron'
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
          { backgroundColor: isDebt ? theme.color.dangerSoft : theme.color.brandSoft },
        ]}
      >
        <Ionicons
          name={isDebt ? 'arrow-up' : 'arrow-down'}
          size={17}
          color={isDebt ? theme.color.dangerStrong : theme.color.brandStrong}
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
        color={isDebt ? 'dangerStrong' : 'brandStrong'}
        numberOfLines={1}
      >
        {isDebt ? '+' : '−'}
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
});
