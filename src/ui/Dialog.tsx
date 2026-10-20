/**
 * Diálogo de alerta y confirmación.
 *
 * Unifica los dos caminos del v1: el `CustomAlert` animado (que solo usaban
 * las pantallas de auth) y el `Alert.alert` nativo (que usaba el resto). Ahora
 * toda la app avisa igual, con el mismo lenguaje visual, y las confirmaciones
 * destructivas se ven destructivas.
 *
 * Se acompaña del hook `useDialog()`, que evita declarar cuatro `useState`
 * por pantalla para mostrar un mensaje.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/core/haptics';
import type { AppError } from '@/core/errors/AppError';
import { Button } from './Button';
import { Text } from './Text';
import { theme } from '@/theme';

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

export interface DialogProps {
  visible: boolean;
  tone?: DialogTone;
  title: string;
  message?: string;
  /** Texto del botón principal. */
  confirmLabel?: string;
  /** Texto del botón secundario. Si no se pasa, el diálogo es informativo. */
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Se ejecuta al cerrar por cualquier vía. */
  onClose: () => void;
  /** Deshabilita los botones mientras una acción está en curso. */
  loading?: boolean;
}

const TONES: Record<
  DialogTone,
  { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }
> = {
  info: { icon: 'information-circle', color: theme.color.info, background: theme.color.infoSoft },
  success: { icon: 'checkmark-circle', color: theme.color.brand, background: theme.color.brandSoft },
  warning: { icon: 'alert-circle', color: theme.color.warning, background: theme.color.warningSoft },
  danger: { icon: 'close-circle', color: theme.color.danger, background: theme.color.dangerSoft },
};

export const Dialog = ({
  visible,
  tone = 'info',
  title,
  message,
  confirmLabel = 'Entendido',
  cancelLabel,
  onConfirm,
  onCancel,
  onClose,
  loading = false,
}: DialogProps) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const palette = TONES[tone];

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: theme.duration.fast });
      scale.value = withSpring(1, theme.spring.snappy);
      if (tone === 'success') haptics.success();
      else if (tone === 'danger') haptics.error();
      else if (tone === 'warning') haptics.warning();
    } else {
      opacity.value = withTiming(0, { duration: theme.duration.fast });
      scale.value = withTiming(0.94, { duration: theme.duration.fast });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tone]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    else onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.host}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onClose}
          accessibilityLabel="Cerrar"
        />

        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          <View style={[styles.iconCircle, { backgroundColor: palette.background }]}>
            <Ionicons name={palette.icon} size={30} color={palette.color} />
          </View>

          <Text variant="title3" align="center" style={styles.title}>
            {title}
          </Text>

          {message ? (
            <Text variant="body" color="textMuted" align="center" style={styles.message}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {/* La acción principal va arriba y a todo el ancho: con dos
                botones en una sola fila, una etiqueta larga como "Cerrar
                sesión" quedaba apretada junto a "Cancelar" y quedaba difícil
                de leer. Apilados, cada uno tiene todo el ancho de la tarjeta. */}
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={handleConfirm}
              loading={loading}
              fullWidth
            />
            {cancelLabel ? (
              <Button
                label={cancelLabel}
                variant="ghost"
                onPress={handleCancel}
                disabled={loading}
                fullWidth
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Hook de conveniencia
 * ──────────────────────────────────────────────────────────────────────────── */

interface DialogState {
  visible: boolean;
  tone: DialogTone;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

const CLOSED: DialogState = { visible: false, tone: 'info', title: '' };

/**
 * Estado de un diálogo, listo para pasar a `<Dialog {...dialog.props} />`.
 *
 * @example
 * const dialog = useDialog();
 * dialog.showError(error);
 * dialog.confirm({ title: '¿Cerrar sesión?', onConfirm: logout, tone: 'danger' });
 */
export const useDialog = () => {
  const [state, setState] = useState<DialogState>(CLOSED);

  const close = useCallback(() => setState((previous) => ({ ...previous, visible: false })), []);

  const show = useCallback((next: Omit<DialogState, 'visible'>) => {
    setState({ ...next, visible: true });
  }, []);

  /** Muestra un `AppError` con su título y mensaje ya resueltos. */
  const showError = useCallback(
    (error: AppError, confirmLabel = 'Entendido') => {
      setState({
        visible: true,
        // Un dato mal escrito o un "espera un minuto" no son fallos graves:
        // se pintan en ámbar, no en rojo.
        tone:
          error.code === 'VALIDATION' || error.code === 'RATE_LIMITED'
            ? 'warning'
            : 'danger',
        title: error.title,
        message: error.message,
        confirmLabel,
      });
    },
    [],
  );

  const showSuccess = useCallback((title: string, message?: string) => {
    setState({ visible: true, tone: 'success', title, message, confirmLabel: 'Listo' });
  }, []);

  const confirm = useCallback(
    (options: {
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      tone?: DialogTone;
      onConfirm: () => void;
    }) => {
      setState({
        visible: true,
        tone: options.tone ?? 'warning',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        onConfirm: options.onConfirm,
      });
    },
    [],
  );

  return {
    show,
    showError,
    showSuccess,
    confirm,
    close,
    /** Props para el componente `Dialog`. */
    props: {
      visible: state.visible,
      tone: state.tone,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      cancelLabel: state.cancelLabel,
      onConfirm: state.onConfirm
        ? () => {
            close();
            state.onConfirm?.();
          }
        : undefined,
      onClose: close,
    } satisfies DialogProps,
  };
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius['3xl'],
    paddingHorizontal: theme.spacing['2xl'],
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing.xl,
    ...theme.shadow.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
  message: {
    marginBottom: theme.spacing.xl,
  },
  actions: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
});
