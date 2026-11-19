/**
 * Desactivar la cuenta propia: una pausa, no una despedida.
 *
 * Es la alternativa suave a eliminarla. Cierra la sesión en todos los
 * dispositivos y nadie puede entrar con la cuenta, pero **no se borra nada**:
 * sus negocios siguen activos y su equipo sigue trabajando en ellos. Para
 * volver basta iniciar sesión y elegir reactivarla (ver `LoginScreen`).
 *
 * Si pasan 48 meses sin volver, el backend la anonimiza: conservar datos
 * personales sin un uso no se justifica para siempre.
 *
 * Igual que al cambiar la contraseña o eliminar la cuenta, el servidor ya
 * invalidó las sesiones, así que al terminar solo se limpia el dispositivo
 * (`endSession`).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { accountApi } from '@/features/account/api/accountApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  AppBar,
  Button,
  Card,
  Dialog,
  IconBubble,
  Screen,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'log-out-outline', text: 'Se cierra tu sesión en todos tus dispositivos.' },
  { icon: 'archive-outline', text: 'No se borra nada: tus datos y tus vales quedan guardados.' },
  {
    icon: 'storefront-outline',
    text: 'Tus negocios siguen activos y tu equipo puede seguir trabajando en ellos.',
  },
  { icon: 'refresh-outline', text: 'Para volver, inicia sesión y elige reactivarla.' },
];

export const DeactivateAccountScreen = () => {
  const { endSession } = useSession();
  const dialog = useDialog();

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!password) {
      setPasswordError('Escribe tu contraseña para confirmar');
      return;
    }
    setIsSubmitting(true);
    try {
      await accountApi.deactivate(password);
      dialog.show({
        tone: 'info',
        title: 'Tu cuenta quedó desactivada',
        message: 'Cuando quieras volver, inicia sesión y elige reactivarla.',
        confirmLabel: 'Entendido',
        onConfirm: () => {
          void endSession();
        },
      });
    } catch (caught) {
      const error = toAppError(caught);
      // El único 400 posible aquí es la contraseña.
      if (error.code === 'VALIDATION') {
        setPasswordError(error.message);
        return;
      }
      dialog.showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAndSubmit = () =>
    dialog.confirm({
      tone: 'warning',
      title: '¿Desactivar tu cuenta?',
      message: 'Se cerrará tu sesión en todos tus dispositivos. No se borra nada.',
      confirmLabel: 'Desactivar',
      onConfirm: () => {
        void submit();
      },
    });

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Desactivar mi cuenta"
          onPress={confirmAndSubmit}
          loading={isSubmitting}
          disabled={!password}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Desactivar cuenta" />

      <IconBubble icon="pause-circle-outline" tone="warning" size={56} />

      <Text variant="title2" style={styles.title}>
        Tómate una pausa
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Desactivar tu cuenta es temporal. Si lo que quieres es que borremos tus datos,
        elimínala en su lugar.
      </Text>

      <Card padding="lg" style={styles.card}>
        {POINTS.map((point) => (
          <View key={point.text} style={styles.point}>
            <Ionicons name={point.icon} size={18} color={theme.color.textMuted} />
            <Text variant="body" style={styles.pointText}>
              {point.text}
            </Text>
          </View>
        ))}
      </Card>

      <Text variant="caption" color="textSubtle" style={styles.note}>
        Si pasan 4 años sin que vuelvas, eliminaremos tus datos personales.
      </Text>

      <TextField
        label="Tu contraseña"
        placeholder="Para confirmar que eres tú"
        icon="key-outline"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (value) setPasswordError(undefined);
        }}
        error={passwordError}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        containerStyle={styles.password}
      />

      <Dialog {...dialog.props} loading={isSubmitting} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  card: {
    gap: theme.spacing.md,
  },
  point: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  pointText: {
    flex: 1,
  },
  note: {
    marginTop: theme.spacing.md,
  },
  password: {
    marginTop: theme.spacing.xl,
  },
});
