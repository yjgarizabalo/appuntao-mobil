/**
 * Inicio de sesión.
 *
 * Estructura visual: héroe oscuro con la marca arriba y una tarjeta clara que
 * "sube" desde abajo con el formulario. Es el patrón de las apps de delivery:
 * la marca se presenta, y la acción queda cerca del pulgar.
 *
 * El identificador acepta correo **o** número de documento, como en el v1: el
 * tendero suele recordar su cédula antes que su correo.
 *
 * **Ingreso rápido.** Si la persona marcó "Recordar mis datos" la última vez,
 * la tarjeta muestra `QuickLoginPanel` en vez del formulario: entra con la
 * huella, el rostro o el bloqueo del celular (`model/rememberedLogin.ts`). Si
 * la app abrió sin sesión, el aviso del sistema se lanza solo, una vez. El
 * formulario queda a un toque, y la casilla para recordar los datos solo
 * aparece si el teléfono tiene con qué protegerlos. Mientras se lee el
 * teléfono la tarjeta espera vacía: mostrar el formulario y cambiarlo un
 * instante después por el panel se ve como un salto.
 *
 * Esta pantalla no usa `<Screen keyboardAware>` porque el héroe necesita ir
 * detrás de la hoja del formulario; por eso repite un `KeyboardAvoidingView`
 * propio, con la misma librería (`react-native-keyboard-controller`) y el
 * mismo `behavior="padding"` que usa `Screen`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';

import { deviceAuthLabel } from '@/core/device/deviceAuth';
import { AppError, toAppError } from '@/core/errors/AppError';
import { routes } from '@/core/navigation/routes';
import { useForm } from '@/core/hooks/useForm';
import { emailOrDocument, required } from '@/core/utils/validation';
import type { LoginCredentials } from '@/features/auth/api/authApi';
import {
  QuickLoginPanel,
  deviceAuthIcon,
} from '@/features/auth/components/QuickLoginPanel';
import {
  takeAutoPrompt,
  unlockRememberedLogin,
} from '@/features/auth/model/rememberedLogin';
import { useRememberedLogin } from '@/features/auth/model/useRememberedLogin';
import {
  type LoginOptions,
  type LoginOutcome,
  useSession,
} from '@/features/auth/session/SessionProvider';
import {
  Button,
  CheckboxField,
  Dialog,
  PressableScale,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const { login } = useSession();
  const dialog = useDialog();
  const toast = useToast();
  const remembered = useRememberedLogin();

  const [isReactivating, setIsReactivating] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  /** Eligió el formulario aunque haya una cuenta recordada. */
  const [wantsForm, setWantsForm] = useState(false);
  /** Casilla "Recordar mis datos". Desmarcada por defecto: es opcional. */
  const [remember, setRemember] = useState(false);

  const authKind =
    remembered.support.status === 'available' ? remembered.support.kind : null;
  const authLabel = authKind ? deviceAuthLabel(authKind) : '';
  const quickAccount = authKind ? remembered.account : null;
  const showQuickLogin = Boolean(quickAccount) && !wantsForm;

  const form = useForm({
    initialValues: { identifier: '', password: '' },
    rules: {
      identifier: [emailOrDocument],
      password: [required('La contraseña')],
    },
    onSubmit: async (values) => {
      await signIn(
        { identifier: values.identifier.trim(), password: values.password },
        // Sin manera de proteger los datos no hay casilla, y no se toca nada.
        { remember: authKind ? remember : undefined },
      );
    },
  });

  /* ── Ingreso ──────────────────────────────────────────────────────────── */

  /** Muestra el formulario, opcionalmente con el identificador ya escrito. */
  const openForm = (identifier = '', keepRemembering = false) => {
    form.reset({ identifier, password: '' });
    setRemember(keepRemembering);
    setWantsForm(true);
  };

  /** Avisa cómo quedó la casilla de recordar, si se marcó. */
  const announceRemember = (options: LoginOptions, outcome: LoginOutcome) => {
    if (options.remember !== true) return;
    if (outcome.remembered) {
      toast.success(`Listo: la próxima vez entras con ${authLabel}.`);
    } else {
      toast.error('No pudimos guardar tus datos en este celular. Entrarás con tu contraseña.');
    }
  };

  /** Repite el login pidiendo reactivar la cuenta. */
  const reactivate = async (credentials: LoginCredentials, options: LoginOptions) => {
    setIsReactivating(true);
    try {
      const outcome = await login({ ...credentials, reactivate: true }, options);
      if (options.remember === true && !outcome.remembered) {
        announceRemember(options, outcome);
      } else {
        toast.success('¡Qué bueno tenerte de vuelta!');
      }
      router.replace(routes.tabs.home);
    } catch (caught) {
      dialog.showError(toAppError(caught));
    } finally {
      setIsReactivating(false);
    }
  };

  /**
   * Inicia sesión y resuelve sus errores. Lo usan el formulario y el ingreso
   * rápido (`fromQuickLogin`), que comparten todo salvo qué hacer con un 401.
   */
  const signIn = async (
    credentials: LoginCredentials,
    options: LoginOptions,
    fromQuickLogin = false,
  ) => {
    try {
      const outcome = await login(credentials, options);
      announceRemember(options, outcome);
      router.replace(routes.tabs.home);
    } catch (caught) {
      const error = toAppError(caught);

      /**
       * La contraseña era correcta pero la cuenta no está activa. El backend
       * solo lo dice después de comprobar la contraseña, así que aquí ya se
       * sabe que es su dueño:
       *  - la desactivó él o pidió eliminarla → se ofrece reactivarla, que es
       *    repetir el login con `reactivate: true` (y cancela la eliminación);
       *  - la desactivó un administrador → solo soporte puede ayudar.
       */
      if (error.code === 'FORBIDDEN' && error.reason) {
        if (
          error.reason === 'ACCOUNT_DEACTIVATED' ||
          error.reason === 'ACCOUNT_DELETION_PENDING'
        ) {
          const pendingDeletion = error.reason === 'ACCOUNT_DELETION_PENDING';
          dialog.confirm({
            tone: 'warning',
            title: pendingDeletion ? 'Tu cuenta se va a eliminar' : 'Tu cuenta está desactivada',
            message: pendingDeletion
              ? `${error.message} Si la reactivas, se cancela la eliminación y todo sigue como estaba.`
              : 'La desactivaste tú. Si la reactivas, todo vuelve a estar como lo dejaste.',
            confirmLabel: pendingDeletion ? 'Conservar mi cuenta' : 'Reactivar mi cuenta',
            cancelLabel: 'Ahora no',
            onConfirm: () => {
              void reactivate(credentials, options);
            },
          });
          return;
        }

        // La contraseña era correcta, pero falta confirmar el correo. El
        // backend ya envió el código; al confirmarlo se vuelve aquí.
        if (error.reason === 'EMAIL_NOT_VERIFIED') {
          const email = typeof error.payload?.email === 'string' ? error.payload.email : '';
          if (email) {
            router.push(routes.auth.verifyEmail(email, 'login'));
            return;
          }
        }

        if (error.reason === 'ACCOUNT_DISABLED') {
          dialog.showError(
            new AppError('FORBIDDEN', { title: 'Cuenta desactivada', message: error.message }),
          );
          return;
        }
      }

      /**
       * Un 401 del ingreso rápido significa que la contraseña guardada ya no
       * sirve (lo normal: la cambió en otro teléfono). Se borra y se pide la
       * actual, con la casilla marcada para que vuelva a quedar recordada.
       */
      if (error.code === 'UNAUTHORIZED' && fromQuickLogin) {
        await remembered.forget();
        openForm(credentials.identifier, true);
        dialog.showError(
          new AppError('UNAUTHORIZED', {
            title: 'Escribe tu contraseña',
            message:
              'La contraseña guardada en este celular ya no funciona; puede que la hayas cambiado. Entra con la actual y volveremos a recordarla.',
          }),
        );
        return;
      }

      /**
       * Un 401 del login no es una sesión vencida, así que el título por
       * defecto de `UNAUTHORIZED` ("Sesión no válida") despista: se cambia.
       *
       * El **mensaje**, en cambio, lo manda el backend cuando lo da: ya no
       * todos los 401 son "contraseña mala" —también responde así cuando el
       * dato escrito pertenece a dos cuentas, y ahí explica qué hacer—. Solo
       * si calla se usa el texto propio.
       *
       * El 429 (demasiados intentos) trae su propio mensaje y **no** se
       * reintenta solo: el usuario decide cuándo volver a probar.
       */
      if (error.code === 'UNAUTHORIZED') {
        dialog.showError(
          new AppError('UNAUTHORIZED', {
            title: 'No pudimos entrar',
            message:
              error.detail ??
              'El correo, celular o documento, o la contraseña, no coinciden. Revísalos e intenta de nuevo.',
          }),
        );
        return;
      }

      dialog.showError(error);
    }
  };

  /** Pide la huella (o el bloqueo del celular) y entra con lo recordado. */
  const handleUnlock = async () => {
    if (!quickAccount || !authKind || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const result = await unlockRememberedLogin(quickAccount, authKind);

      if (result.status === 'unlocked') {
        await signIn(result.credentials, {}, true);
        return;
      }

      if (result.status === 'error') {
        if (result.forgotten) {
          await remembered.reload();
          openForm(quickAccount.identifier);
        }
        dialog.show({
          tone: 'warning',
          title: result.title,
          message: result.message,
          confirmLabel: 'Entendido',
        });
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  /**
   * Aviso automático: al abrir la app sin sesión y con una cuenta recordada,
   * se pide la huella sin esperar al toque. Una sola vez por arranque
   * (`takeAutoPrompt`), y solo con la app en primer plano: iOS cancela el
   * aviso si se pide mientras la app todavía está entrando.
   */
  const handleUnlockRef = useRef(handleUnlock);
  useEffect(() => {
    handleUnlockRef.current = handleUnlock;
  });
  const canAutoPrompt = remembered.isReady && Boolean(quickAccount);
  useEffect(() => {
    if (!canAutoPrompt || AppState.currentState !== 'active') return;
    if (!takeAutoPrompt()) return;
    void handleUnlockRef.current();
  }, [canAutoPrompt]);

  // Esta pantalla no usa `Screen` (arma su propio héroe a pantalla completa),
  // así que fija el estilo por su cuenta con el mismo mecanismo: al recibir el
  // foco, nunca con el `<StatusBar>` declarativo.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
    }, []),
  );

  /* ── Vista ────────────────────────────────────────────────────────────── */

  const renderForm = () => (
    <>
      <Text variant="title2">Hola de nuevo</Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Ingresa para ver tus clientes y sus saldos.
      </Text>

      <TextField
        label="Correo, celular o documento"
        placeholder="tu@correo.com o 1020304050"
        icon="person-outline"
        value={form.values.identifier}
        onChangeText={form.handleChange('identifier')}
        onBlur={form.handleBlur('identifier')}
        error={form.visibleError('identifier')}
        autoCapitalize="none"
        autoComplete="username"
        keyboardType="email-address"
        returnKeyType="next"
        textContentType="username"
      />

      <TextField
        label="Contraseña"
        placeholder="Tu contraseña"
        icon="lock-closed-outline"
        value={form.values.password}
        onChangeText={form.handleChange('password')}
        onBlur={form.handleBlur('password')}
        error={form.visibleError('password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={form.submit}
      />

      <PressableScale
        onPress={() => router.push(routes.auth.forgotPassword(form.values.identifier.trim()))}
        haptic="select"
        style={styles.forgot}
      >
        <Text variant="captionStrong" color="brandStrong">
          ¿Olvidaste tu contraseña?
        </Text>
      </PressableScale>

      {authKind ? (
        <CheckboxField
          checked={remember}
          onChange={setRemember}
          label="Recordar mis datos en este celular"
          style={styles.remember}
        >
          <Text variant="caption" color="textMuted">
            La próxima vez entras con {authLabel}, sin escribir tu contraseña. Actívalo solo
            si el celular es tuyo.
          </Text>
        </CheckboxField>
      ) : null}

      <Button
        label="Entrar"
        onPress={form.submit}
        loading={form.isSubmitting || isReactivating}
        size="lg"
        fullWidth
        style={styles.submit}
      />

      {quickAccount && authKind ? (
        <Button
          label={
            quickAccount.firstName
              ? `Entrar como ${quickAccount.firstName}`
              : `Entrar con ${authLabel}`
          }
          icon={deviceAuthIcon(authKind)}
          variant="ghost"
          onPress={() => setWantsForm(false)}
          fullWidth
          style={styles.backToQuick}
        />
      ) : null}

      <View style={styles.footer}>
        <Text variant="body" color="textMuted">
          ¿No tienes cuenta?
        </Text>
        <PressableScale
          onPress={() => router.push(routes.auth.register)}
          haptic="tap"
          style={styles.footerAction}
        >
          <Text variant="bodyStrong" color="brandStrong">
            Crear cuenta
          </Text>
        </PressableScale>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradient.hero} style={styles.hero}>
        <View style={[styles.heroContent, { paddingTop: insets.top + theme.spacing['3xl'] }]}>
          <Image
            source={require('../../../../assets/images/icon-blanco.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text variant="bodyLg" color="textInverseMuted" style={styles.tagline}>
            Lleva el control de tus vales sin cuadernos ni cuentas perdidas.
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.formHost} behavior="padding">
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + theme.spacing['2xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!remembered.isReady ? null : showQuickLogin && quickAccount && authKind ? (
            <QuickLoginPanel
              account={quickAccount}
              kind={authKind}
              loading={isUnlocking || isReactivating}
              onUnlock={() => void handleUnlock()}
              onUsePassword={() => openForm(quickAccount.identifier, true)}
              onUseOtherAccount={() => openForm()}
            />
          ) : (
            renderForm()
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog {...dialog.props} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.surfaceInverse,
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    paddingHorizontal: theme.layout.gutter,
    gap: theme.spacing.xxs,
  },
  logo: {
    // El PNG es ~4:1 (1640×411): con 148×60 `contain` lo dejaba en 148×37.
    // Se fija el ancho y la proporción del archivo para que llene la caja.
    width: 235,
    maxWidth: '70%',
    aspectRatio: 1640 / 411,
    marginBottom: theme.spacing.md,
  },
  tagline: {
    marginTop: theme.spacing.xs,
    maxWidth: 300,
  },
  formHost: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexGrow: 0,
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius['3xl'],
    borderTopRightRadius: theme.radius['3xl'],
    maxHeight: '78%',
  },
  sheetContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing['2xl'],
  },
  subtitle: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
  },
  forgot: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.xs,
  },
  remember: {
    marginTop: theme.spacing.md,
  },
  submit: {
    marginTop: theme.spacing.lg,
  },
  backToQuick: {
    marginTop: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing['2xl'],
  },
  footerAction: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
});
