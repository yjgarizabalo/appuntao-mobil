/**
 * Recuperar la contraseña olvidada.
 *
 * Una sola pantalla con tres pasos, porque es un solo trámite y volver atrás
 * entre pasos no debe sacar al usuario del flujo:
 *
 *  1. **Correo** → `POST /auth/password/forgot`. El backend responde lo mismo
 *     exista o no la cuenta, así que la app tampoco lo distingue: siempre
 *     pasa al paso del código.
 *  2. **Código** de 6 dígitos que llegó al correo → `verify-code`. Solo
 *     comprueba; sirve para no pedir la contraseña nueva con un código malo.
 *     Se puede pedir otro a los 60 segundos (el backend ignora los pedidos
 *     antes de eso).
 *  3. **Contraseña nueva** → `reset`. El backend cierra todas las sesiones y
 *     no inicia sesión: se vuelve al login.
 *
 * Los errores del código llegan siempre como el mismo 400 (equivocado,
 * vencido o agotado); se pintan junto al campo con el texto del backend.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppError, toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { routes } from '@/core/navigation/routes';
import {
  email as emailRule,
  matches,
  password as passwordRule,
  required,
} from '@/core/utils/validation';
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

type Step = 'email' | 'code' | 'password';

/** Lo mismo que espera el backend antes de aceptar otro pedido de código. */
const RESEND_SECONDS = 60;

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const ForgotPasswordScreen = () => {
  const params = useLocalSearchParams<{ email?: string }>();
  const dialog = useDialog();
  const toast = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  /** 429 y fallos de red van a un diálogo; el resto lo decide cada paso. */
  const showError = (caught: unknown) => dialog.showError(toAppError(caught));

  /* ── Paso 1: correo ───────────────────────────────────────────────────── */

  const emailForm = useForm({
    initialValues: { email: params.email?.includes('@') ? params.email.trim() : '' },
    rules: { email: [required('El correo'), emailRule] },
    onSubmit: async (values) => {
      const target = values.email.trim().toLowerCase();
      try {
        await authApi.requestPasswordReset(target);
        setEmail(target);
        setCode('');
        setResendIn(RESEND_SECONDS);
        setStep('code');
      } catch (caught) {
        showError(caught);
      }
    },
  });

  /* ── Paso 2: código ───────────────────────────────────────────────────── */

  const codeForm = useForm({
    initialValues: { code: '' },
    rules: {
      code: [
        (value) => (onlyDigits(value).length === 6 ? undefined : 'El código tiene 6 dígitos'),
      ],
    },
    onSubmit: async (values) => {
      const typed = onlyDigits(values.code);
      try {
        await authApi.verifyPasswordResetCode(email, typed);
        setCode(typed);
        setStep('password');
      } catch (caught) {
        const error = toAppError(caught);
        if (error.code === 'VALIDATION') {
          codeForm.setFieldError('code', error.message);
          return;
        }
        showError(error);
      }
    },
  });

  const resend = async () => {
    if (resendIn > 0 || isResending) return;
    setIsResending(true);
    try {
      await authApi.requestPasswordReset(email);
      codeForm.reset({ code: '' });
      setResendIn(RESEND_SECONDS);
      toast.success('Te enviamos un código nuevo. El anterior ya no sirve.');
    } catch (caught) {
      showError(caught);
    } finally {
      setIsResending(false);
    }
  };

  /* ── Paso 3: contraseña nueva ─────────────────────────────────────────── */

  const passwordForm = useForm({
    initialValues: { password: '', confirmPassword: '' },
    rules: { password: [passwordRule] },
    onSubmit: async (values) => {
      if (values.password !== values.confirmPassword) {
        passwordForm.setFieldError('confirmPassword', 'Las contraseñas no coinciden');
        return;
      }
      try {
        await authApi.resetPassword(email, code, values.password);
        dialog.show({
          tone: 'success',
          title: 'Contraseña cambiada',
          message:
            'Ya puedes entrar con tu contraseña nueva. Por seguridad cerramos la sesión en todos tus dispositivos.',
          confirmLabel: 'Iniciar sesión',
          onConfirm: () => router.replace(routes.auth.login),
        });
      } catch (caught) {
        const error = toAppError(caught);
        // El código venció o se agotó entre un paso y otro: hay que pedir otro.
        if (error.code === 'VALIDATION' && error.message.includes('código')) {
          setStep('code');
          codeForm.reset({ code: '' });
          codeForm.setFieldError('code', error.message);
          return;
        }
        if (error.code === 'VALIDATION') {
          dialog.showError(
            new AppError('VALIDATION', {
              title: 'Revisa la contraseña',
              message: 'Debe tener al menos 8 caracteres, con letras y números.',
            }),
          );
          return;
        }
        showError(error);
      }
    },
  });

  /* ── Navegación ───────────────────────────────────────────────────────── */

  const goBack = () => {
    if (step === 'password') {
      setStep('code');
      return;
    }
    if (step === 'code') {
      setStep('email');
      return;
    }
    router.back();
  };

  /* ── Vista ────────────────────────────────────────────────────────────── */

  const confirmError =
    passwordForm.visibleError('confirmPassword') ??
    (passwordForm.values.confirmPassword.length > 0
      ? matches(passwordForm.values.password, 'Las contraseñas no coinciden')(
          passwordForm.values.confirmPassword,
        )
      : undefined);

  const footer =
    step === 'email' ? (
      <Button
        label="Enviar código"
        onPress={emailForm.submit}
        loading={emailForm.isSubmitting}
        disabled={emailForm.values.email.trim().length === 0}
        size="lg"
        fullWidth
      />
    ) : step === 'code' ? (
      <Button
        label="Continuar"
        onPress={codeForm.submit}
        loading={codeForm.isSubmitting}
        disabled={onlyDigits(codeForm.values.code).length !== 6}
        size="lg"
        fullWidth
      />
    ) : (
      <Button
        label="Cambiar contraseña"
        onPress={passwordForm.submit}
        loading={passwordForm.isSubmitting}
        disabled={passwordForm.values.password.length === 0}
        size="lg"
        fullWidth
      />
    );

  return (
    <Screen scroll padded keyboardAware footer={footer}>
      <AppBar onBack={goBack} />

      {step === 'email' ? (
        <>
          <IconBubble icon="mail-outline" tone="brand" size={56} />
          <Text variant="title2" style={styles.title}>
            ¿Olvidaste tu contraseña?
          </Text>
          <Text variant="body" color="textMuted" style={styles.subtitle}>
            Escribe el correo de tu cuenta y te enviaremos un código para crear una
            contraseña nueva.
          </Text>

          <TextField
            label="Correo"
            placeholder="tu@correo.com"
            icon="mail-outline"
            value={emailForm.values.email}
            onChangeText={emailForm.handleChange('email')}
            onBlur={emailForm.handleBlur('email')}
            error={emailForm.visibleError('email')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={emailForm.submit}
          />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <IconBubble icon="keypad-outline" tone="brand" size={56} />
          <Text variant="title2" style={styles.title}>
            Revisa tu correo
          </Text>
          <Text variant="body" color="textMuted" style={styles.subtitle}>
            Si <Text variant="bodyStrong">{email}</Text> es el correo de una cuenta,
            te llegó un código de 6 dígitos. Vence en 15 minutos. Si no lo ves, revisa
            la carpeta de spam.
          </Text>

          <TextField
            label="Código"
            placeholder="000000"
            icon="keypad-outline"
            value={codeForm.values.code}
            onChangeText={(value) => codeForm.handleChange('code')(onlyDigits(value))}
            onBlur={codeForm.handleBlur('code')}
            error={codeForm.visibleError('code')}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={codeForm.submit}
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
            <PressableScale onPress={() => setStep('email')} haptic="select" style={styles.action}>
              <Text variant="captionStrong" color="brandStrong">
                Cambiar correo
              </Text>
            </PressableScale>
          </View>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <IconBubble icon="lock-closed-outline" tone="brand" size={56} />
          <Text variant="title2" style={styles.title}>
            Crea tu contraseña nueva
          </Text>
          <Text variant="body" color="textMuted" style={styles.subtitle}>
            Usa al menos 8 caracteres, con letras y números. Al cambiarla se cerrará la
            sesión en todos tus dispositivos.
          </Text>

          <TextField
            label="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            icon="lock-closed-outline"
            value={passwordForm.values.password}
            onChangeText={passwordForm.handleChange('password')}
            onBlur={passwordForm.handleBlur('password')}
            error={passwordForm.visibleError('password')}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />

          <TextField
            label="Confirmar contraseña"
            placeholder="Repite la contraseña"
            icon="lock-closed-outline"
            value={passwordForm.values.confirmPassword}
            onChangeText={passwordForm.handleChange('confirmPassword')}
            onBlur={passwordForm.handleBlur('confirmPassword')}
            error={confirmError}
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={passwordForm.submit}
          />
        </>
      ) : null}

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
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  action: {
    paddingVertical: theme.spacing.xs,
  },
});
