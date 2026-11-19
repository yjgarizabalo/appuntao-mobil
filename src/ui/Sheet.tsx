/**
 * Bottom sheet con gesto de arrastre.
 *
 * Es el patrón que la gente ya conoce de las apps de delivery: la acción no
 * te saca de la pantalla, aparece desde abajo sobre el contexto y se cierra
 * arrastrando. Reemplaza a los `Modal` centrados del v1.
 *
 * Notas de implementación:
 *  - `GestureHandlerRootView` va **dentro** del `Modal`: en Android los
 *    gestos no llegan a los hijos de un modal si no se re-monta la raíz.
 *  - la animación de salida se completa antes de desmontar, para que no
 *    "desaparezca de golpe";
 *  - `KeyboardAvoidingView` interno porque casi todas las hojas tienen inputs.
 *    Es el de `react-native-keyboard-controller`, no el de React Native: el
 *    nativo se dejaba **sin comportamiento en Android** (`behavior: undefined`)
 *    porque dentro de un `Modal` con `statusBarTranslucent` no calculaba bien
 *    la altura del teclado, así que los formularios de las hojas (fiar,
 *    registrar pago) nunca lo evitaban. `behavior="padding"` con esta librería
 *    sí funciona igual en las dos plataformas, incluso dentro del `Modal`.
 */
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/core/haptics';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { theme } from '@/theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Se llama cuando la hoja **terminó** de cerrarse (animación incluida), la
   * haya cerrado el usuario o el padre. Es el momento de abrir un `Dialog`
   * que la hoja disparó: la hoja y el diálogo son dos `Modal`, y si el diálogo
   * aparece mientras la hoja sigue montada, queda detrás de ella.
   */
  onClosed?: () => void;
  title?: string;
  subtitle?: string;
  /**
   * Líneas máximas del título antes de truncar con puntos suspensivos.
   * Por defecto `1`: la mayoría de títulos son cortos y fijos ("Registrar
   * cliente"). Una hoja que abre para mostrar un texto largo del usuario
   * completo (p. ej. el nombre de una deuda) puede subir este número.
   */
  titleNumberOfLines?: number;
  children: ReactNode;
  /** Barra de acciones fija al fondo de la hoja. */
  footer?: ReactNode;
  /** `false` impide cerrar tocando el fondo o arrastrando (durante un envío). */
  dismissible?: boolean;
  /** Envuelve el contenido en un ScrollView (formularios largos). */
  scrollable?: boolean;
}

/** Distancia arrastrada a partir de la cual se cierra al soltar. */
const DISMISS_THRESHOLD = 110;
/** Velocidad de arrastre que cierra la hoja aunque no se alcance el umbral. */
const DISMISS_VELOCITY = 900;

export const Sheet = ({
  visible,
  onClose,
  onClosed,
  title,
  subtitle,
  titleNumberOfLines = 1,
  children,
  footer,
  dismissible = true,
  scrollable = false,
}: SheetProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [isMounted, setIsMounted] = useState(visible);
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);

  /**
   * `notify` distingue quién cerró la hoja:
   *  - el usuario (backdrop, gesto, botón X) → hay que avisar al padre;
   *  - el padre, poniendo `visible` en false → ya lo sabe, avisarle otra vez
   *    dispararía dos veces cualquier limpieza que haga en `onClose`.
   */
  const finishClose = useCallback(
    (notify: boolean) => {
      setIsMounted(false);
      if (notify) onClose();
      onClosed?.();
    },
    [onClose, onClosed],
  );

  const animateOut = useCallback(
    (notify: boolean) => {
      backdropOpacity.value = withTiming(0, { duration: theme.duration.fast });
      translateY.value = withTiming(
        windowHeight,
        { duration: theme.duration.normal },
        (finished) => {
          if (finished) runOnJS(finishClose)(notify);
        },
      );
    },
    [backdropOpacity, finishClose, translateY, windowHeight],
  );

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      translateY.value = windowHeight;
      backdropOpacity.value = withTiming(1, { duration: theme.duration.normal });
      translateY.value = withSpring(0, theme.spring.soft);
      haptics.tap();
    } else if (isMounted) {
      animateOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = useCallback(() => {
    if (!dismissible) return;
    animateOut(true);
  }, [animateOut, dismissible]);

  const panGesture = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      // Solo se permite arrastrar hacia abajo; hacia arriba se amortigua.
      translateY.value = event.translationY > 0 ? event.translationY : event.translationY * 0.1;
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, theme.spring.snappy);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!isMounted) return null;

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollArea}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.backdropPress}
            onPress={requestClose}
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
          />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.keyboardHost}
          behavior="padding"
          pointerEvents="box-none"
        >
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                { maxHeight: windowHeight * 0.9, paddingBottom: insets.bottom },
                sheetStyle,
              ]}
            >
              {/* Asa de arrastre */}
              <View style={styles.handleArea}>
                <View style={styles.handle} />
              </View>

              {title ? (
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text variant="title3" numberOfLines={titleNumberOfLines}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {dismissible ? (
                    <IconButton
                      icon="close"
                      onPress={requestClose}
                      accessibilityLabel="Cerrar"
                      surface="soft"
                      size={18}
                    />
                  ) : null}
                </View>
              ) : null}

              {body}

              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.overlay,
  },
  backdropPress: { flex: 1 },
  keyboardHost: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius['3xl'],
    borderTopRightRadius: theme.radius['3xl'],
    ...theme.shadow.xl,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  content: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.lg,
  },
  scrollArea: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.lg,
  },
  footer: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.color.border,
    gap: theme.spacing.md,
  },
});
