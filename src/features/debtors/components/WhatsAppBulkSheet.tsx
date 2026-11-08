/**
 * Cola de envío de recordatorios por WhatsApp a varios clientes.
 *
 * WhatsApp no tiene una API gratuita para enviar mensajes sin interacción
 * (ver `@/core/utils/whatsapp`), así que "masivo" aquí significa: se abre
 * WhatsApp una vez por cliente, con el mensaje ya escrito, y el tendero
 * confirma el envío desde WhatsApp. Esta hoja lo hace cómodo de dos formas:
 *  - fila por fila, tocando el ícono de WhatsApp de cada quien;
 *  - con el botón "Enviar a todos", que abre el primer chat pendiente y,
 *    cada vez que el tendero **vuelve** a Appuntao (detectado con `AppState`,
 *    porque abrir WhatsApp manda la app a segundo plano), abre solo el
 *    siguiente pendiente — sin que haya que tocar nada más en esta lista.
 * Ninguna de las dos formas envía sola: el "toque" que falta y no se puede
 * automatizar es el botón de enviar dentro de WhatsApp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { formatMoney } from '@/core/utils/format';
import {
  buildDebtReminder,
  buildWhatsAppUrl,
  isWhatsAppAvailable,
  toWhatsAppNumber,
} from '@/core/utils/whatsapp';
import { type Debtor, debtorBalance } from '@/domain/models';
import { Avatar, Badge, Button, Dialog, Divider, IconButton, Sheet, Text, useDialog } from '@/ui';
import { theme } from '@/theme';

export interface WhatsAppBulkSheetProps {
  visible: boolean;
  debtors: Debtor[];
  /** Nombre del negocio que cobra, para personalizar el mensaje de cada uno. */
  getBusinessName: (debtor: Debtor) => string | undefined;
  /** Se avisa cuántos recordatorios se alcanzaron a enviar al cerrar la hoja. */
  onClose: (sentCount: number) => void;
}

/**
 * Pausa antes de relanzar WhatsApp al volver de segundo plano. Sin ella,
 * algunos Android reabren el chat que se acaba de cerrar en vez del
 * siguiente, porque la hoja aún no terminó de recuperar el foco.
 */
const AUTO_ADVANCE_DELAY_MS = 500;

export const WhatsAppBulkSheet = ({
  visible,
  debtors,
  getBusinessName,
  onClose,
}: WhatsAppBulkSheetProps) => {
  const dialog = useDialog();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [isAutoSending, setIsAutoSending] = useState(false);
  const [isCheckingWhatsApp, setIsCheckingWhatsApp] = useState(false);

  // Espejo de `isAutoSending` en un ref: el listener de AppState se suscribe
  // una vez por cambio de cola y necesita leer el valor vigente en el
  // momento del evento, no el que tenía cuando se registró.
  const isAutoSendingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoSending = useCallback(() => {
    isAutoSendingRef.current = false;
    setIsAutoSending(false);
    if (advanceTimeout.current) {
      clearTimeout(advanceTimeout.current);
      advanceTimeout.current = null;
    }
  }, []);

  // La cola arranca limpia cada vez que se abre con una nueva selección, y
  // se detiene si la hoja se cierra a medio envío.
  useEffect(() => {
    if (visible) setSentIds(new Set());
    else stopAutoSending();
  }, [visible, stopAutoSending]);

  const sendTo = useCallback(
    async (debtor: Debtor) => {
      const url = buildWhatsAppUrl(
        debtor.phone,
        buildDebtReminder({
          debtorName: debtor.name,
          businessName: getBusinessName(debtor),
          formattedBalance: formatMoney(debtorBalance(debtor)),
        }),
      );
      if (!url) return;

      try {
        haptics.tap();
        await Linking.openURL(url);
        setSentIds((current) => new Set(current).add(debtor.id));
      } catch (caught) {
        stopAutoSending();
        dialog.showError(toAppError(caught));
      }
    },
    [dialog, getBusinessName, stopAutoSending],
  );

  // Siguiente cliente sin enviar y con un teléfono utilizable. Se salta a
  // quien no tenga uno válido para que la cola no se quede atascada en él.
  const nextPending = useMemo(
    () => debtors.find((debtor) => !sentIds.has(debtor.id) && toWhatsAppNumber(debtor.phone)),
    [debtors, sentIds],
  );

  const allSent = debtors.length > 0 && sentIds.size === debtors.length;

  useEffect(() => {
    if (allSent) {
      stopAutoSending();
      haptics.success();
    }
  }, [allSent, stopAutoSending]);

  // Detecta el regreso a Appuntao tras abrir WhatsApp para avanzar solo la cola.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const cameBack = /inactive|background/.test(appStateRef.current) && nextState === 'active';
      appStateRef.current = nextState;

      if (!visible || !cameBack || !isAutoSendingRef.current || !nextPending) return;

      advanceTimeout.current = setTimeout(() => {
        if (isAutoSendingRef.current) void sendTo(nextPending);
      }, AUTO_ADVANCE_DELAY_MS);
    });

    return () => subscription.remove();
  }, [visible, nextPending, sendTo]);

  const startAutoSend = useCallback(async () => {
    if (!nextPending) return;
    setIsCheckingWhatsApp(true);
    const available = await isWhatsAppAvailable();
    setIsCheckingWhatsApp(false);

    if (!available) {
      dialog.show({
        tone: 'warning',
        title: 'No encontramos WhatsApp',
        message:
          'No detectamos WhatsApp activo en este dispositivo, así que no podemos abrir los chats. Instálalo o inicia sesión para poder enviar los recordatorios.',
        confirmLabel: 'Entendido',
      });
      return;
    }

    haptics.press();
    isAutoSendingRef.current = true;
    setIsAutoSending(true);
    void sendTo(nextPending);
  }, [dialog, nextPending, sendTo]);

  const progress = debtors.length > 0 ? sentIds.size / debtors.length : 0;
  const progressValue = useSharedValue(0);
  useEffect(() => {
    progressValue.value = withTiming(progress, { duration: theme.duration.normal });
  }, [progress, progressValue]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progressValue.value * 100}%` }));

  return (
    <>
      <Sheet
        visible={visible}
        onClose={() => onClose(sentIds.size)}
        title="Enviar recordatorio"
        subtitle={
          debtors.length > 0
            ? allSent
              ? 'Todos enviados'
              : isAutoSending
                ? `Enviando automático… ${sentIds.size} de ${debtors.length}`
                : `${sentIds.size} de ${debtors.length} enviados`
            : undefined
        }
        scrollable
        footer={
          debtors.length === 0 ? undefined : (
            <Button
              label={
                allSent
                  ? 'Todos enviados'
                  : isAutoSending
                    ? `Enviando ${sentIds.size} de ${debtors.length}…`
                    : `Enviar a todos (${debtors.length})`
              }
              icon={allSent ? 'checkmark-circle' : 'logo-whatsapp'}
              variant={allSent ? 'secondary' : 'primary'}
              onPress={() => void startAutoSend()}
              disabled={allSent || isAutoSending || !nextPending}
              loading={isCheckingWhatsApp}
              size="lg"
              fullWidth
            />
          )
        }
      >
        <View>
          {debtors.length > 0 ? (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
          ) : null}

          {debtors.map((debtor, index) => {
            const isSent = sentIds.has(debtor.id);
            return (
              <View key={debtor.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.row}>
                  <Avatar name={debtor.name} size="sm" />

                  <View style={styles.rowBody}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {debtor.name}
                    </Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {formatMoney(debtorBalance(debtor))}
                    </Text>
                  </View>

                  {isSent ? (
                    <Badge label="Enviado" tone="success" icon="checkmark-circle" />
                  ) : (
                    <IconButton
                      icon="logo-whatsapp"
                      onPress={() => void sendTo(debtor)}
                      accessibilityLabel={`Enviar recordatorio a ${debtor.name} por WhatsApp`}
                      color={theme.color.brandStrong}
                      surface="soft"
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Sheet>

      <Dialog {...dialog.props} />
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceSunken,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.brand,
  },
});
