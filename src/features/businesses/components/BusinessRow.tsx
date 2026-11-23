/**
 * Fila de negocio en la lista.
 *
 * Es la hermana de `DebtorRow`: comparte **exactamente** los mismos tokens de
 * tarjeta (radio `lg`, borde `hairlineWidth*2`, paddings `lg`/`md`) para que la
 * lista de negocios y la de clientes se lean como parte del mismo sistema.
 * Antes la tarjeta se armaba a mano en la pantalla con un radio `xl` y un borde
 * `1.5` literales —más redondeada y con distinto grosor— y se notaba que "no
 * eran iguales".
 *
 * Añade tres cosas propias del negocio, que `ListRow` no cubre y por eso esto
 * es un componente aparte (igual que `DebtorRow`): el estado "activo"
 * resaltado en color de marca, el botón secundario para cambiar de negocio
 * activo sin salir de la lista y la estrella del negocio **principal**, el que
 * la app abre siempre.
 *
 * La estrella va fuera de la zona presionable de la fila, no dentro, para no
 * anidar un presionable en otro. Cuando aparece ocupa el lugar del chevron:
 * los dos juntos se leían como dos flechas. Solo se muestra con dos negocios o
 * más (`onToggleFavorite`): con uno solo no hay nada que elegir.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { Business } from '@/domain/models';
import { Badge, Button, IconBubble, IconButton, PressableScale, Text } from '@/ui';
import { theme } from '@/theme';

export interface BusinessRowProps {
  business: Business;
  isActive: boolean;
  /** Es el negocio principal: con el que abre la app. */
  isFavorite?: boolean;
  /** Ver los clientes de este negocio. */
  onOpen: () => void;
  /** Marcar este negocio como el activo. */
  onSelect: () => void;
  /** Marcar o quitar como principal. Sin él, la estrella no se muestra. */
  onToggleFavorite?: () => void;
}

export const BusinessRow = ({
  business,
  isActive,
  isFavorite = false,
  onOpen,
  onSelect,
  onToggleFavorite,
}: BusinessRowProps) => (
  <View style={[styles.container, isActive ? styles.containerActive : null]}>
    <View style={styles.header}>
      <PressableScale
        onPress={onOpen}
        haptic="tap"
        activeScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`Ver los clientes de ${business.name}`}
        style={styles.main}
      >
        <IconBubble icon="storefront" tone={isActive ? 'brand' : 'neutral'} size={48} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {business.name}
            </Text>
            {isActive ? <Badge label="Activo" tone="brand" /> : null}
          </View>

          {business.address ? (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {business.address}
            </Text>
          ) : null}

          {isFavorite ? (
            <View style={styles.favoriteNote}>
              <Ionicons name="star" size={12} color={theme.color.brandStrong} />
              <Text variant="captionStrong" color="brandStrong" numberOfLines={1}>
                Principal · la app abre aquí
              </Text>
            </View>
          ) : null}
        </View>

        {onToggleFavorite ? null : (
          <Ionicons name="chevron-forward" size={18} color={theme.color.textSubtle} />
        )}
      </PressableScale>

      {onToggleFavorite ? (
        <IconButton
          icon={isFavorite ? 'star' : 'star-outline'}
          color={isFavorite ? theme.color.brand : theme.color.textSubtle}
          onPress={onToggleFavorite}
          accessibilityLabel={
            isFavorite
              ? `Quitar ${business.name} como negocio principal`
              : `Marcar ${business.name} como negocio principal`
          }
        />
      ) : null}
    </View>

    {!isActive ? (
      <Button
        label="Usar este negocio"
        variant="ghost"
        size="sm"
        icon="swap-horizontal-outline"
        onPress={onSelect}
        fullWidth
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  /* Mismos tokens que DebtorRow.styles.container: es lo que unifica el look. */
  container: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  containerActive: {
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  favoriteNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.xxs,
  },
});
