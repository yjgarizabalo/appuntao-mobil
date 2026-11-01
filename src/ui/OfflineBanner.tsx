/**
 * Aviso permanente de "sin conexión".
 *
 * Es la contraparte del `Toast`: aquel avisa de algo que acaba de pasar y se
 * va solo; este describe un **estado** y se queda mientras dure. Por eso no
 * tiene botón de cerrar —no se puede "descartar" el no tener internet— y por
 * eso no se puede tocar (`pointerEvents="none"`): informa, no pide nada.
 *
 * Va en la raíz de la app, una sola vez, encima de toda la navegación, así que
 * no hay que acordarse de ponerlo en cada pantalla. Se coloca **debajo** de la
 * barra de estado, no encima: taparla obligaría a forzar el color de sus
 * iconos y eso pelearía con el sistema de `Screen`, que los decide según la
 * pantalla enfocada.
 *
 * Queda montado siempre y se anima con opacidad: montarlo y desmontarlo hacía
 * que la animación de salida no llegara a verse nunca.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '@/core/connectivity';
import { Text } from './Text';
import { theme } from '@/theme';

/**
 * Alto de la píldora. Lo necesita el `Toast` para apartarse y no quedar encima
 * cuando los dos coinciden en pantalla.
 */
export const OFFLINE_BANNER_HEIGHT = 34;

export const OfflineBanner = () => {
  const insets = useSafeAreaInsets();
  const { isOffline } = useConnectivity();

  const progress = useDerivedValue(
    () => withTiming(isOffline ? 1 : 0, { duration: theme.duration.normal }),
    [isOffline],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -12 }],
  }));

  return (
    <View
      style={[styles.host, { top: insets.top + theme.spacing.xs }]}
      pointerEvents="none"
      // El lector de pantalla sí debe anunciarlo: es la explicación de por qué
      // la app dejó de traer datos.
      accessibilityLiveRegion={isOffline ? 'polite' : 'none'}
    >
      <Animated.View style={[styles.pill, animatedStyle]}>
        <Ionicons
          name="cloud-offline-outline"
          size={15}
          color={theme.color.textInverse}
        />
        <Text variant="captionStrong" color="textInverse" numberOfLines={1}>
          Sin conexión a internet
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: theme.layout.gutter,
    right: theme.layout.gutter,
    alignItems: 'center',
    zIndex: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: OFFLINE_BANNER_HEIGHT,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceInverse,
    ...theme.shadow.md,
  },
});
