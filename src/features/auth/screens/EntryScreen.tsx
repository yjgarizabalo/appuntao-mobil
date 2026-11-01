/**
 * Puerta de entrada: decide entre login y home mientras se rehidrata la
 * sesión, y mientras tanto sostiene la pantalla de marca.
 *
 * El splash nativo (`app.json > expo-splash-screen`) usa el mismo fondo
 * oscuro y el mismo isotipo blanco que `BrandSplash`, así que el relevo entre
 * uno y otro no se nota — antes eran fondo blanco con glifo oscuro contra un
 * degradado oscuro con isotipo blanco, y ese contraste se veía como un
 * parpadeo. `SplashScreen.hideAsync()` se dispara en el primer `onLayout` de
 * `BrandSplash`, nunca antes: si se ocultara al importar el módulo, alcanzaría
 * a verse un frame en blanco mientras el degradado todavía no pinta.
 *
 * El tiempo mínimo visible evita que una sesión ya cacheada (restauración
 * casi instantánea) haga parpadear el splash en menos de lo que dura un
 * parpadeo real — el mismo motivo por el que Instagram o Rappi sostienen su
 * marca un instante aunque la sesión ya esté lista.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { routes } from '@/core/navigation/routes';
import { useSession } from '@/features/auth/session/SessionProvider';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import { Text } from '@/ui';
import { theme } from '@/theme';

/** Milisegundos mínimos visibles del splash de marca, ver comentario arriba. */
const MIN_VISIBLE_MS = 450;

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedText = Animated.createAnimatedComponent(Text);

export const EntryScreen = () => {
  const { status } = useSession();
  const { mode, isReady: isModeReady } = useAppMode();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Se espera también al modo guardado: redirigir antes mandaría siempre al
  // inicio del tendero y, un instante después, saltaría al del cliente. Ese
  // parpadeo es justo lo que este splash existe para evitar.
  const ready = status !== 'loading' && isModeReady && minTimeElapsed;

  if (!ready) return <BrandSplash />;

  if (status !== 'authenticated') return <Redirect href={routes.auth.login} />;

  return (
    <Redirect href={mode === 'client' ? routes.clientMode.wallet : routes.tabs.home} />
  );
};

const BrandSplash = () => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const taglineOpacity = useSharedValue(0);
  const spinnerOpacity = useSharedValue(0);

  // Vive sobre el degradado oscuro: iconos claros desde el primer frame.
  useEffect(() => {
    setStatusBarStyle('light');
  }, []);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: theme.duration.slow });
    logoScale.value = withSpring(1, theme.spring.soft);
    taglineOpacity.value = withDelay(
      theme.duration.normal,
      withTiming(1, { duration: theme.duration.slow }),
    );
    spinnerOpacity.value = withDelay(
      theme.duration.slow,
      withTiming(1, { duration: theme.duration.normal }),
    );
  }, [logoOpacity, logoScale, taglineOpacity, spinnerOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const spinnerStyle = useAnimatedStyle(() => ({ opacity: spinnerOpacity.value }));

  // El primer layout confirma que el degradado y el isotipo ya están en
  // pantalla: es el momento seguro para revelar esta pantalla ocultando el
  // splash nativo, sin dejar un frame en blanco entre los dos.
  const revealBehindNativeSplash = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <LinearGradient
      colors={theme.gradient.hero}
      style={styles.container}
      onLayout={revealBehindNativeSplash}
    >
      <View style={styles.brand}>
        <AnimatedImage
          source={require('../../../../assets/images/icon-blanco.png')}
          style={[styles.logo, logoStyle]}
          contentFit="contain"
        />
        <AnimatedText variant="body" color="textInverseMuted" style={taglineStyle}>
          Tus vales, siempre al día
        </AnimatedText>
      </View>

      <Animated.View style={[styles.spinner, spinnerStyle]}>
        <ActivityIndicator color={theme.palette.brand[300]} />
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  logo: {
    width: 128,
    height: 52,
    marginBottom: theme.spacing.sm,
  },
  spinner: {
    position: 'absolute',
    bottom: 80,
  },
});
