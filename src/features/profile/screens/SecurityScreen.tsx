/**
 * Cambio de contraseña.
 *
 * Añade sobre el v1 un indicador de fuerza en vivo y la comprobación de que
 * las dos contraseñas coinciden mientras se escribe, en lugar de avisarlo solo
 * al pulsar guardar.
 *
 * El backend endureció esta operación y la pantalla lo refleja en dos puntos:
 *
 *  - pide la **contraseña actual** (`PATCH /users/me/password`), así que
 *    tener el teléfono desbloqueado ya no basta para cambiarla;
 *  - al terminar, el servidor **cierra todas las sesiones** del usuario. Por
 *    eso no se vuelve atrás con un toast: se avisa con un diálogo y se sale
 *    al login, que es lo que va a pasar de todas formas.
 */
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { matches, password as passwordRule, required } from '@/core/utils/validation';
import { authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  Screen,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

/** Cuatro niveles: cada criterio cumplido sube uno. */
const passwordStrength = (value: string): { level: 0 | 1 | 2 | 3 | 4; label: string } => {
  if (value.length === 0) return { level: 0, label: '' };

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score += 1;

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'] as const;
  const level = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { level, label: labels[level] };
};

const STRENGTH_COLOR = [
  theme.color.danger,
  theme.color.danger,
  theme.color.warning,
  theme.color.brand,
  theme.color.brandStrong,
] as const;

export const SecurityScreen = () => {
  const { endSession } = useSession();
  const dialog = useDialog();

  const form = useForm({
    initialValues: { currentPassword: '', password: '', confirmPassword: '' },
    rules: {
      currentPassword: [required('La contraseña actual')],
      password: [passwordRule],
    },
    onSubmit: async (values) => {
      if (values.password !== values.confirmPassword) {
        form.setFieldError('confirmPassword', 'Las contraseñas no coinciden');
        return;
      }

      if (values.password === values.currentPassword) {
        form.setFieldError('password', 'La contraseña nueva debe ser distinta de la actual');
        return;
      }

      try {
        await authApi.updatePassword(values.currentPassword, values.password);

        dialog.show({
          tone: 'success',
          title: 'Contraseña actualizada',
          message:
            'Por seguridad cerramos la sesión en todos tus dispositivos. Entra de nuevo con tu contraseña nueva.',
          confirmLabel: 'Iniciar sesión',
          // No se navega a mano: al quedarse sin sesión, la guardia de
          // `app/(app)/_layout.tsx` lleva al login por su cuenta.
          onConfirm: () => {
            void endSession();
          },
        });
      } catch (caught) {
        const error = toAppError(caught);

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }

        /**
         * El backend solo rechaza esto con 400 por dos motivos: la contraseña
         * actual no coincide, o la nueva es demasiado corta. Lo segundo no
         * puede llegar aquí —el validador local exige más— así que el error
         * se pinta en el campo de la contraseña actual, con el texto que
         * mandó el servidor, en vez de en un diálogo que no señala a nada.
         */
        if (error.code === 'VALIDATION' && error.detail) {
          form.setFieldError('currentPassword', error.detail);
          return;
        }

        dialog.showError(error);
      }
    },
  });

  const strength = passwordStrength(form.values.password);
  const confirmError =
    form.visibleError('confirmPassword') ??
    (form.values.confirmPassword.length > 0
      ? matches(form.values.password, 'Las contraseñas no coinciden')(
          form.values.confirmPassword,
        )
      : undefined);

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Actualizar contraseña"
          onPress={form.submit}
          loading={form.isSubmitting}
          disabled={
            form.values.currentPassword.length === 0 || form.values.password.length === 0
          }
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Seguridad" />

      <IconBubble icon="shield-checkmark-outline" tone="brand" size={56} />

      <Text variant="title2" style={styles.title}>
        Cambia tu contraseña
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Usa una contraseña que no uses en otras aplicaciones. Al cambiarla se
        cerrará la sesión en todos tus dispositivos.
      </Text>

      <TextField
        label="Contraseña actual"
        placeholder="La que usas hoy"
        icon="key-outline"
        value={form.values.currentPassword}
        onChangeText={form.handleChange('currentPassword')}
        onBlur={form.handleBlur('currentPassword')}
        error={form.visibleError('currentPassword')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />

      <TextField
        label="Nueva contraseña"
        placeholder="Mínimo 8 caracteres"
        icon="lock-closed-outline"
        value={form.values.password}
        onChangeText={form.handleChange('password')}
        onBlur={form.handleBlur('password')}
        error={form.visibleError('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {/* Indicador de fuerza: cuatro segmentos que se colorean */}
      {form.values.password.length > 0 ? (
        <View style={styles.strength}>
          <View style={styles.strengthBars}>
            {[1, 2, 3, 4].map((segment) => (
              <View
                key={segment}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      strength.level >= segment
                        ? STRENGTH_COLOR[strength.level]
                        : theme.color.surfaceSunken,
                  },
                ]}
              />
            ))}
          </View>
          <Text variant="caption" color={STRENGTH_COLOR[strength.level]}>
            {strength.label}
          </Text>
        </View>
      ) : null}

      <TextField
        label="Confirmar contraseña"
        placeholder="Repite la contraseña"
        icon="lock-closed-outline"
        value={form.values.confirmPassword}
        onChangeText={form.handleChange('confirmPassword')}
        onBlur={form.handleBlur('confirmPassword')}
        error={confirmError}
        secureTextEntry
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={form.submit}
        containerStyle={styles.confirmField}
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing['2xl'],
  },
  strength: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  confirmField: {
    marginTop: theme.spacing.xs,
  },
});
