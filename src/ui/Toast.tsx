/**
 * Avisos efímeros (toasts).
 *
 * Para confirmaciones que no requieren decisión —"Pago registrado",
 * "Cliente creado"— un toast es mejor que un diálogo: informa sin obligar a
 * pulsar "Entendido". Los diálogos quedan para lo que sí necesita una
 * respuesta.
 *
 * Se monta una sola vez en el layout raíz y se dispara desde cualquier
 * pantalla con `useToast()`.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '@/core/connectivity';
import { OFFLINE_BANNER_HEIGHT } from './OfflineBanner';

import { haptics } from '@/core/haptics';
import { Text } from './Text';
import { theme } from '@/theme';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Milisegundos visibles. Por defecto 2600. */
  durationMs?: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<
  ToastTone,
  { icon: keyof typeof Ionicons.glyphMap; background: string; foreground: string }
> = {
  success: {
    icon: 'checkmark-circle',
    background: theme.color.surfaceInverse,
    foreground: theme.palette.brand[300],
  },
  error: {
    icon: 'alert-circle',
    background: theme.color.surfaceInverse,
    foreground: theme.palette.danger[300],
  },
  info: {
    icon: 'information-circle',
    background: theme.color.surfaceInverse,
    foreground: theme.palette.info[100],
  },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets();
  const { isOffline } = useConnectivity();
  const [toast, setToast] = useState<Required<ToastOptions> | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  const hide = useCallback(() => {
    opacity.value = withTiming(0, { duration: theme.duration.fast });
    translateY.value = withTiming(-140, { duration: theme.duration.normal });
  }, [opacity, translateY]);

  const show = useCallback(
    ({ message, tone = 'info', durationMs = 2600 }: ToastOptions) => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);

      setToast({ message, tone, durationMs });
      translateY.value = withSpring(0, theme.spring.soft);
      opacity.value = withTiming(1, { duration: theme.duration.fast });

      if (tone === 'success') haptics.success();
      else if (tone === 'error') haptics.error();

      hideTimeout.current = setTimeout(hide, durationMs);
    },
    [hide, opacity, translateY],
  );

  useEffect(
    () => () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show({ message, tone: 'success' }),
      error: (message: string) => show({ message, tone: 'error' }),
      info: (message: string) => show({ message, tone: 'info' }),
    }),
    [show],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const palette = toast ? TONES[toast.tone] : TONES.info;

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `pointerEvents="box-none"` deja pasar los toques a la pantalla que
          está debajo, salvo en el propio toast. */}
      <View
        style={[
          styles.host,
          {
            // Si la píldora de "sin conexión" está arriba, el toast baja para
            // no quedar encima: los dos viven en la misma esquina.
            top:
              insets.top +
              theme.spacing.sm +
              (isOffline ? OFFLINE_BANNER_HEIGHT + theme.spacing.xs : 0),
          },
        ]}
        pointerEvents="box-none"
      >
        {toast ? (
          <Animated.View style={animatedStyle}>
            <Pressable
              onPress={hide}
              style={[styles.toast, { backgroundColor: palette.background }]}
              accessibilityRole="alert"
              accessibilityLabel={toast.message}
            >
              <Ionicons name={palette.icon} size={20} color={palette.foreground} />
              <Text variant="bodyStrong" color="textInverse" style={styles.message} numberOfLines={3}>
                {toast.message}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md + 2,
    ...theme.shadow.lg,
  },
  message: {
    flex: 1,
  },
});
