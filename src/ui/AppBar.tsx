/**
 * Barra superior.
 *
 * Aplica el inset superior real del dispositivo (notch / Dynamic Island /
 * status bar de Android) y centra el título de forma óptica: los laterales
 * tienen el mismo ancho mínimo, así el título no se desplaza cuando hay botón
 * de volver a un lado y nada al otro.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { theme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface AppBarProps {
  title?: string;
  subtitle?: string;
  /** Muestra el botón de volver. */
  onBack?: () => void;
  /** Icono de la acción de la derecha. */
  actionIcon?: IconName;
  onAction?: () => void;
  actionLabel?: string;
  /** Contenido libre a la derecha (tiene prioridad sobre `actionIcon`). */
  right?: ReactNode;
  /** Sobre fondo oscuro. */
  inverse?: boolean;
  /** Línea inferior de separación. */
  bordered?: boolean;
  /** Alinea el título a la izquierda, tamaño grande (pantallas principales). */
  large?: boolean;
}

export const AppBar = ({
  title,
  subtitle,
  onBack,
  actionIcon,
  onAction,
  actionLabel,
  right,
  inverse = false,
  bordered = false,
  large = false,
}: AppBarProps) => {
  const insets = useSafeAreaInsets();

  const foreground = inverse ? theme.color.textInverse : theme.color.text;
  const mutedForeground = inverse ? theme.color.textInverseMuted : theme.color.textMuted;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + theme.spacing.xs,
          backgroundColor: 'transparent',
        },
        bordered
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth * 2,
              borderBottomColor: inverse ? theme.color.borderInverse : theme.color.border,
            }
          : null,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.side, styles.sideLeft]}>
          {onBack ? (
            <IconButton
              icon="chevron-back"
              onPress={onBack}
              accessibilityLabel="Volver"
              color={foreground}
              surface={inverse ? 'inverse' : 'none'}
              size={24}
            />
          ) : null}
        </View>

        <View style={large ? styles.titleBlockLarge : styles.titleBlock}>
          {title ? (
            <Text
              variant={large ? 'title1' : 'title3'}
              color={foreground}
              align={large ? 'left' : 'center'}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              variant="caption"
              color={mutedForeground}
              align={large ? 'left' : 'center'}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.sideRight]}>
          {right ??
            (actionIcon ? (
              <IconButton
                icon={actionIcon}
                onPress={onAction}
                accessibilityLabel={actionLabel ?? 'Acción'}
                color={foreground}
                surface={inverse ? 'inverse' : 'none'}
              />
            ) : null)}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.layout.appBarHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  /** Ancho mínimo igual a los dos lados: mantiene el título óptimamente centrado. */
  side: {
    minWidth: 44,
    justifyContent: 'center',
  },
  sideLeft: { alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  titleBlockLarge: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.md,
  },
});
