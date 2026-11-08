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
 * Esta pantalla no usa `<Screen keyboardAware>` porque el héroe necesita ir
 * detrás de la hoja del formulario; por eso repite un `KeyboardAvoidingView`
 * propio, con la misma librería (`react-native-keyboard-controller`) y el
 * mismo `behavior="padding"` que usa `Screen`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';

import { AppError, toAppError } from '@/core/errors/AppError';
import { routes } from '@/core/navigation/routes';
import { useForm } from '@/core/hooks/useForm';
import { emailOrDocument, required } from '@/core/utils/validation';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  Button,
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

  const form = useForm({
    initialValues: { identifier: '', password: '' },
    rules: {
      identifier: [emailOrDocument],
      password: [required('La contraseña')],
    },
    onSubmit: async (values) => {
      try {
        await login({
          identifier: values.identifier.trim(),
          password: values.password,
        });
        router.replace(routes.tabs.home);
      } catch (caught) {
        const error = toAppError(caught);

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
    },
  });

  // Esta pantalla no usa `Screen` (arma su propio héroe a pantalla completa),
  // así que fija el estilo por su cuenta con el mismo mecanismo: al recibir el
  // foco, nunca con el `<StatusBar>` declarativo.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
    }, []),
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
            onPress={() =>
              toast.info('La recuperación de contraseña estará disponible pronto.')
            }
            haptic="select"
            style={styles.forgot}
          >
            <Text variant="captionStrong" color="brandStrong">
              ¿Olvidaste tu contraseña?
            </Text>
          </PressableScale>

          <Button
            label="Entrar"
            onPress={form.submit}
            loading={form.isSubmitting}
            size="lg"
            fullWidth
            style={styles.submit}
          />

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
  submit: {
    marginTop: theme.spacing.lg,
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
