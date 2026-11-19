/**
 * Propuestas para quedarse con un negocio, pendientes de respuesta.
 *
 * Aparece arriba en Inicio y en Mis negocios solo cuando hay alguna
 * (`GET /business/ownership-transfers/incoming`); si no, no ocupa espacio.
 *
 * Aceptar convierte al usuario en dueño: responde por el negocio y por los
 * datos de sus clientes. Por eso se confirma, y después se vuelve a consultar
 * la puerta legal: al ser dueño le toca aceptar los documentos para negocios.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { formatLongDate } from '@/core/utils/format';
import type { OwnershipTransfer } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { ownershipApi } from '@/features/businesses/api/ownershipApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { useLegalGate } from '@/features/legal/components/LegalGate';
import { Button, Card, Dialog, IconBubble, Text, useDialog, useToast } from '@/ui';
import { theme } from '@/theme';

export const IncomingTransfersCard = () => {
  const { user } = useSession();
  const { refresh: refreshBusinesses, selectBusiness } = useBusinesses();
  const { recheck } = useLegalGate();
  const dialog = useDialog();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useAsyncData(ownershipApi.incoming, {
    enabled: Boolean(user?.id),
    deps: [user?.id],
  });

  // Al volver a la pantalla se vuelve a preguntar (con un respiro de 15 s):
  // la propuesta pudo llegar, cancelarse o vencer mientras tanto.
  const lastCheckRef = useRef(Date.now());
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastCheckRef.current < 15_000) return;
      lastCheckRef.current = Date.now();
      void incoming.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incoming.refresh]),
  );

  const accept = (transfer: OwnershipTransfer) =>
    dialog.confirm({
      tone: 'info',
      title: `¿Quedarte con ${transfer.businessName}?`,
      message:
        'Serás el dueño: responderás por el negocio y por los datos de sus clientes. Quien te lo pasa quedará como administrador.',
      confirmLabel: 'Aceptar',
      cancelLabel: 'Todavía no',
      onConfirm: async () => {
        setBusyId(transfer.id);
        try {
          const message = await ownershipApi.accept(transfer.id);
          toast.success(message || `Ahora eres el dueño de ${transfer.businessName}`);
          await refreshBusinesses();
          selectBusiness(transfer.businessId);
          await incoming.reload();
          await recheck();
        } catch (caught) {
          dialog.showError(toAppError(caught));
          await incoming.reload();
        } finally {
          setBusyId(null);
        }
      },
    });

  const reject = (transfer: OwnershipTransfer) =>
    dialog.confirm({
      tone: 'warning',
      title: '¿Rechazar la propuesta?',
      message: `${transfer.businessName} sigue siendo de ${transfer.fromName || 'quien te lo propuso'}.`,
      confirmLabel: 'Rechazar',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setBusyId(transfer.id);
        try {
          await ownershipApi.reject(transfer.id);
          toast.info('Propuesta rechazada');
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          await incoming.reload();
          setBusyId(null);
        }
      },
    });

  const transfers = incoming.data ?? [];
  if (!transfers.length) return <Dialog {...dialog.props} />;

  return (
    <View style={styles.host}>
      {transfers.map((transfer) => (
        <Card key={transfer.id} padding="lg" style={styles.card}>
          <View style={styles.header}>
            <IconBubble icon="swap-horizontal-outline" tone="brand" size={38} />
            <View style={styles.headerText}>
              <Text variant="bodyStrong">
                {transfer.fromName || 'Alguien'} quiere pasarte {transfer.businessName}
              </Text>
              <Text variant="caption" color="textMuted">
                Tienes hasta el {formatLongDate(transfer.expiresAt)} para responder.
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              label="Rechazar"
              variant="ghost"
              size="sm"
              onPress={() => reject(transfer)}
              disabled={busyId !== null}
            />
            <Button
              label="Aceptar"
              size="sm"
              onPress={() => accept(transfer)}
              loading={busyId === transfer.id}
              disabled={busyId !== null && busyId !== transfer.id}
            />
          </View>
        </Card>
      ))}
      <Dialog {...dialog.props} />
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  card: {
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
});
