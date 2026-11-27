/**
 * Propuestas para quedarse con un negocio, pendientes de respuesta.
 *
 * Aparece arriba en Inicio y en Mis negocios solo cuando hay alguna
 * (`GET /business/ownership-transfers/incoming`); si no, no ocupa espacio.
 *
 * Aceptar convierte al usuario en dueño: responde por el negocio y por los
 * datos de sus clientes. Por eso "Aceptar" lleva a una pantalla propia
 * (`AcceptTransferScreen`) donde lee y acepta los documentos para negocios,
 * que el backend exige.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatLongDate } from '@/core/utils/format';
import type { OwnershipTransfer } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { ownershipApi } from '@/features/businesses/api/ownershipApi';
import { Button, Card, Dialog, IconBubble, Text, useDialog, useToast } from '@/ui';
import { theme } from '@/theme';

export const IncomingTransfersCard = () => {
  const { user } = useSession();
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
    router.push(routes.business.acceptTransfer(transfer));

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
