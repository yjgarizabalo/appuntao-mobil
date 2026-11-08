/**
 * Botón de un solo icono, con área táctil garantizada.
 *
 * El icono puede verse pequeño (20pt), pero la zona presionable siempre mide
 * al menos 44pt: es el mínimo de las guías de accesibilidad de iOS y Android,
 * y la causa habitual de "le doy y no pasa nada".
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { theme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  /** Etiqueta para lectores de pantalla. Obligatoria: el icono no se "lee". */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  /** Fondo circular detrás del icono. */
  surface?: 'none' | 'soft' | 'solid' | 'inverse';
  disabled?: boolean;
  style?: ViewStyle;
}

const SURFACES: Record<NonNullable<IconButtonProps['surface']>, ViewStyle> = {
  none: { backgroundColor: 'transparent' },
  soft: { backgroundColor: theme.color.surfaceSunken },
  solid: { backgroundColor: theme.color.surface, ...theme.shadow.xs },
  inverse: { backgroundColor: theme.color.fillInverse },
};

export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 22,
  color = theme.color.text,
  surface = 'none',
  disabled = false,
  style,
}: IconButtonProps) => {
  const box = Math.max(theme.layout.hitSlopMin, size + theme.spacing.xl);

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      activeScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        SURFACES[surface],
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={size}
        color={disabled ? theme.color.disabledText : color}
      />
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
