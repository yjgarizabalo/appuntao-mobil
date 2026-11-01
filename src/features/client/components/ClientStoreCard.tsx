/**
 * Tarjeta de una tienda en la que al usuario le fían.
 *
 * Es la fila que responde la pregunta del cliente de un vistazo: en esta
 * tienda, ¿debo o estoy al día? El saldo manda el color —rojo si debe, verde
 * si no— y el vencimiento se avisa con un badge ámbar, el mismo código que ya
 * usa el tendero en su lista de clientes.
 *
 * Se arma sobre `ListRow` para heredar la animación de presión, el chevron y
 * la etiqueta de accesibilidad sin repetirlos.
 */
import { StyleSheet, View } from 'react-native';

import { formatMoney, formatRelativeDate, pluralize } from '@/core/utils/format';
import type { ClientStanding } from '@/domain/models';
import { Badge, IconBubble, ListRow, Text } from '@/ui';
import { theme } from '@/theme';

export interface ClientStoreCardProps {
  standing: ClientStanding;
  onPress: () => void;
}

export const ClientStoreCard = ({ standing, onPress }: ClientStoreCardProps) => {
  const { account, summary, failed } = standing;
  const hasDebt = summary.balance > 0;
  const isOverdue = Boolean(summary.oldestOverdueDate);

  /**
   * La tienda que no cargó se muestra igual, pero sin cifra: un saldo en cero
   * ahí sería mentira, y esconder la fila dejaría al usuario sin saber que
   * falta información.
   */
  if (failed) {
    return (
      <ListRow
        leading={<IconBubble icon="cloud-offline-outline" tone="neutral" size={44} />}
        title={account.businessName}
        subtitle="No se pudo cargar. Desliza para reintentar."
        onPress={onPress}
        chevron
      />
    );
  }

  const subtitle = hasDebt
    ? isOverdue
      ? `Venció ${formatRelativeDate(summary.oldestOverdueDate)}`
      : pluralize(summary.openDebts, 'vale pendiente', 'vales pendientes')
    : 'Estás al día';

  return (
    <ListRow
      leading={
        <IconBubble
          icon="storefront-outline"
          tone={isOverdue ? 'warning' : hasDebt ? 'danger' : 'brand'}
          size={44}
        />
      }
      title={account.businessName}
      subtitle={subtitle}
      trailing={
        <View style={styles.trailing}>
          <Text
            variant="money"
            color={hasDebt ? 'dangerStrong' : 'brandStrong'}
            numberOfLines={1}
          >
            {formatMoney(summary.balance)}
          </Text>
          {isOverdue ? <Badge label="Vencido" tone="warning" size="sm" /> : null}
        </View>
      }
      onPress={onPress}
      chevron
    />
  );
};

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
});
