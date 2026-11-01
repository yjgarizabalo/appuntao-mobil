/**
 * Casilla de aceptación de los Términos y Condiciones del registro.
 *
 * Va en una tarjeta propia, justo encima del botón de crear cuenta: es un
 * consentimiento, no un campo más del formulario, y mezclarlo con "Seguridad"
 * haría que se marque sin verlo.
 *
 * Son dos zonas táctiles separadas a propósito —la fila que marca y la fila
 * que abre el documento—, en vez del enlace incrustado en la frase: un enlace
 * dentro de una fila presionable deja al usuario sin saber si al tocar está
 * aceptando o leyendo, y en Android la prioridad entre los dos toques depende
 * de dónde cae el dedo.
 *
 * El botón "Crear cuenta" **no** se desactiva mientras esté sin marcar: un
 * botón apagado sin explicación es el motivo clásico de abandono en un
 * registro. Se deja pulsable y, si falta la aceptación, el error aparece aquí.
 *
 * Pendiente conocido: hoy la aceptación se queda en el dispositivo porque
 * `POST /users` todavía no la recibe. Cuando el backend la acepte, lo que se
 * envía es `TERMS.version` de `@/domain/legal` —ya está en el documento— junto
 * con la fecha; este componente no cambia.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { routes } from '@/core/navigation/routes';
import { Card, CheckboxField, Divider, PressableScale, Text } from '@/ui';
import { theme } from '@/theme';

export interface TermsAcceptanceProps {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  /** Mensaje cuando se intentó crear la cuenta sin aceptar. */
  error?: string;
}

export const TermsAcceptance = ({ accepted, onChange, error }: TermsAcceptanceProps) => (
  <Card padding="lg" style={styles.card}>
    <View style={styles.eyebrow}>
      <Ionicons name="shield-checkmark-outline" size={14} color={theme.color.textSubtle} />
      <Text variant="overline" color="textSubtle" uppercase>
        Tratamiento de datos
      </Text>
    </View>

    <CheckboxField
      checked={accepted}
      onChange={onChange}
      error={error}
      label="He leído y acepto los Términos y Condiciones y la Política de Tratamiento de Datos Personales de fiao."
    >
      {error ? null : (
        <Text variant="caption" color="textSubtle">
          Necesario para crear tu cuenta.
        </Text>
      )}
    </CheckboxField>

    <View style={styles.separator}>
      <Divider />
    </View>

    <PressableScale
      onPress={() => router.push(routes.legal.terms)}
      haptic="tap"
      activeScale={0.99}
      style={styles.readRow}
      accessibilityRole="button"
      accessibilityLabel="Leer los Términos y Condiciones completos"
    >
      <Ionicons name="document-text-outline" size={18} color={theme.color.brandStrong} />
      <Text variant="captionStrong" color="brandStrong" style={styles.readLabel}>
        Leer el documento completo
      </Text>
      <Ionicons name="chevron-forward" size={16} color={theme.color.brandStrong} />
    </PressableScale>
  </Card>
);

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.xl,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  separator: {
    marginVertical: theme.spacing.md,
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    // Zona táctil completa aunque el texto sea de una sola línea.
    minHeight: theme.layout.hitSlopMin,
  },
  readLabel: {
    flex: 1,
  },
});
