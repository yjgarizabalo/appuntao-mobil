/**
 * Marca de selección múltiple y su campo de formulario.
 *
 * `Checkbox` es la marca sola: mismo lenguaje visual que el círculo de
 * `OptionPicker` —relleno de marca con `checkmark-circle` cuando está marcada,
 * círculo vacío con borde cuando no—. Es puramente visual; el toque lo maneja
 * quien la envuelve, normalmente una fila con `PressableScale`, para no anidar
 * un presionable dentro de otro.
 *
 * `CheckboxField` es la marca con etiqueta y error: la fila **entera** es la
 * zona táctil (22 px de círculo son un blanco demasiado pequeño para el pulgar)
 * y el error se pinta debajo con el mismo formato que `TextField`, para que un
 * formulario no tenga dos maneras distintas de decir lo mismo.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { theme } from '@/theme';

export interface CheckboxProps {
  checked: boolean;
  /** Círculo apagado: el elemento no se puede seleccionar. */
  disabled?: boolean;
  /** Pinta el borde en rojo cuando está sin marcar y hace falta marcarla. */
  invalid?: boolean;
  size?: number;
  style?: ViewStyle;
}

export const Checkbox = ({
  checked,
  disabled = false,
  invalid = false,
  size = 22,
  style,
}: CheckboxProps) => {
  if (checked) {
    return (
      <View style={style}>
        <Ionicons
          name="checkmark-circle"
          size={size}
          color={disabled ? theme.color.disabledText : theme.color.brand}
        />
      </View>
    );
  }

  const borderColor = disabled
    ? theme.color.disabled
    : invalid
      ? theme.color.danger
      : theme.color.borderStrong;

  return (
    <View
      style={[
        styles.empty,
        { width: size, height: size, borderRadius: size / 2, borderColor },
        style,
      ]}
    />
  );
};

/* ── Campo de formulario ──────────────────────────────────────────────────── */

export interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta de una línea o varias. Para texto compuesto, usa `children`. */
  label?: string;
  /** Contenido libre debajo de la etiqueta (aclaraciones, enlaces). */
  children?: ReactNode;
  /** Mensaje de error. Mientras exista, la marca se pinta en rojo. */
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const CheckboxField = ({
  checked,
  onChange,
  label,
  children,
  error,
  disabled = false,
  style,
}: CheckboxFieldProps) => (
  <View style={style}>
    <PressableScale
      onPress={() => onChange(!checked)}
      disabled={disabled}
      haptic="select"
      activeScale={0.99}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
    >
      <Checkbox checked={checked} disabled={disabled} invalid={Boolean(error)} />

      <View style={styles.body}>
        {label ? (
          <Text variant="body" color={disabled ? 'disabledText' : 'text'}>
            {label}
          </Text>
        ) : null}
        {children}
      </View>
    </PressableScale>

    {error ? (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle" size={13} color={theme.color.danger} />
        <Text variant="caption" color="danger" style={styles.errorText}>
          {error}
        </Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  empty: {
    borderWidth: 2,
  },
  row: {
    flexDirection: 'row',
    // Arriba y no al centro: con etiquetas de dos o tres líneas, la marca debe
    // quedar junto al primer renglón, no flotando a media altura.
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  body: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
  },
});
