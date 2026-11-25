/**
 * Confirmar el correo con el código de 6 dígitos que llegó.
 *
 * Se llega aquí de dos formas, y el backend ya envió el código en las dos:
 *
 *  - `from=register`: recién creada la cuenta, si el backend respondió
 *    `emailVerificationRequired: true`. Al confirmar se va al login.
 *  - `from=login`: el login respondió 403 `EMAIL_NOT_VERIFIED`. Al confirmar
 *    se vuelve al login, que sigue con los datos escritos.
 *
 * Exigirlo depende del entorno: en production siempre; en local y QA solo
 * con `REQUIRE_EMAIL_VERIFICATION=true` en el backend. Si no se exige, esta
 * pantalla no aparece.
 *
 * Los errores del código llegan siempre como el mismo 400 (equivocado,
 * vencido o agotado); se pintan junto al campo con el texto del backend.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { routes } from '@/core/navigation/routes';
import { authApi } from '@/features/auth/api/authApi';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  PressableScale,
  Screen,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

/** Lo mismo que espera el backend antes de aceptar otro pedido de código. */
const RESEND_SECONDS = 60;

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const VerifyEmailScreen = () => {
  const params = useLocalSearchParams<{ email?: string; from?: string }>();
  const email = (params.email ?? '').trim().toLowerCase();
  const fromLogin = params.from === 'login';
  const dialog = useDialog();
  const toast = useToast();

  // El backend acaba de enviar un código: el primero se puede pedir de nuevo
  // en un minuto, igual que el backend.
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const leave = () => {
    if (fromLogin && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(routes.auth.login);
  };

  const form = useForm({
    initialValues: { code: '' },
    rules: {
      code: [
        (value) => (onlyDigits(value).length === 6 ? undefined : 'El código tiene 6 dígitos'),
      ],
    },
    onSubmit: async (values) => {
      try {
        await authApi.verifyEmail(email, onlyDigits(values.code));
        if (fromLogin) {
          toast.success('Correo confirmado. Ya puedes entrar.');
          leave();
          return;
        }
        dialog.show({
          tone: 'success',
          title: 'Correo confirmado',
          message: 'Tu cuenta quedó lista. Inicia sesión con tu correo y tu contraseña.',
          confirmLabel: 'Iniciar sesión',
          onConfirm: () => router.replace(routes.auth.login),
        });
      } catch (caught) {
        const error = toAppError(caught);
        if (error.code === 'VALIDATION') {
          form.setFieldError('code', error.message);
          return;
        }
        dialog.showError(error);
      }
    },
  });

  const resend = async () => {
    if (resendIn > 0 || isResending) return;
    setIsResending(true);
    try {
      await authApi.sendEmailVerificationCode(email);
      form.reset({ code: '' });
      setResendIn(RESEND_SECONDS);
      toast.success('Te enviamos un código nuevo. El anterior ya no sirve.');
    } catch (caught) {
      dialog.showError(toAppError(caught));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Confirmar correo"
          onPress={form.submit}
          loading={form.isSubmitting}
          disabled={onlyDigits(form.values.code).length !== 6}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={leave} />

      <IconBubble icon="mail-unread-outline" tone="brand" size={56} />
      <Text variant="title2" style={styles.title}>
        Confirma tu correo
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Te enviamos un código de 6 dígitos a <Text variant="bodyStrong">{email}</Text>. Vence en
        15 minutos. Si no lo ves, revisa la carpeta de spam.
      </Text>

      <TextField
        label="Código"
        placeholder="000000"
        icon="keypad-outline"
        value={form.values.code}
        onChangeText={(value) => form.handleChange('code')(onlyDigits(value))}
        onBlur={form.handleBlur('code')}
        error={form.visibleError('code')}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={form.submit}
      />

      <View style={styles.actions}>
        <PressableScale
          onPress={() => void resend()}
          disabled={resendIn > 0 || isResending}
          haptic="select"
          style={styles.action}
        >
          <Text
            variant="captionStrong"
            color={resendIn > 0 || isResending ? 'textMuted' : 'brandStrong'}
          >
            {resendIn > 0 ? `Pedir otro código en ${resendIn} s` : 'Pedir otro código'}
          </Text>
        </PressableScale>
      </View>

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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.spacing.sm,
  },
  action: {
    paddingVertical: theme.spacing.xs,
  },
});
