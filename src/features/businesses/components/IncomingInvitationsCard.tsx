/**
 * Invitaciones que le llegaron al usuario, pendientes de respuesta.
 *
 * `GET /invitations/incoming` devuelve las dirigidas al correo o teléfono de
 * su cuenta. Es lo que cierra el caso "desde cero": la tienda invita a un
 * número, la persona instala la app, se registra con ese número y al entrar
 * la invitación ya está aquí.
 *
 * "Aceptar" lleva a escribir el código que le llegó por WhatsApp o correo: el
 * backend lo exige, porque el teléfono de una cuenta no se verifica y otra
 * persona podría haberse registrado con él.
 *
 * Aparece en Inicio (también sin negocios, que es donde cae alguien recién
 * registrado), en Mis negocios y en el modo cliente. Si no hay ninguna, no
 * ocupa espacio.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatLongDate } from '@/core/utils/format';
import { BUSINESS_ROLE_LABEL } from '@/domain/constants';
import type { Invitation } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { Button, Card, Dialog, IconBubble, Text, useDialog, useToast } from '@/ui';
import { theme } from '@/theme';

/** Título de la tarjeta según el tipo. */
const headline = (invitation: Invitation): string => {
  const business = invitation.businessName ?? 'Un negocio';
  if (invitation.type === 'DEBTOR') return `${business} te invita a ver tu cuenta`;
  const role = invitation.role ? BUSINESS_ROLE_LABEL[invitation.role] : 'miembro';
  return `${business} te invita a su equipo como ${role}`;
};

export const IncomingInvitationsCard = () => {
  const { user } = useSession();
  const dialog = useDialog();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useAsyncData(invitationApi.incoming, {
    enabled: Boolean(user?.id),
    deps: [user?.id],
  });

  // Al volver a la pantalla se vuelve a preguntar (con un respiro de 15 s):
  // la invitación pudo llegar, cancelarse o vencer mientras tanto.
  const lastCheckRef = useRef(Date.now());
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastCheckRef.current < 15_000) return;
      lastCheckRef.current = Date.now();
      void incoming.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incoming.refresh]),
  );

  // La pantalla del código explica qué pasa al aceptar y pide confirmar.
  const accept = (invitation: Invitation) =>
    router.push(routes.invitation.accept(invitation.businessName ?? undefined));

  const reject = (invitation: Invitation) =>
    dialog.confirm({
      tone: 'warning',
      title: '¿Rechazar la invitación?',
      message: `${invitation.businessName ?? 'El negocio'} tendría que invitarte de nuevo si cambias de opinión.`,
      confirmLabel: 'Rechazar',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setBusyId(invitation.id);
        try {
          await invitationApi.reject(invitation.id);
          toast.info('Invitación rechazada');
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          await incoming.reload();
          setBusyId(null);
        }
      },
    });

  const invitations = incoming.data ?? [];
  if (!invitations.length) return <Dialog {...dialog.props} />;

  return (
    <View style={styles.host}>
      {invitations.map((invitation) => (
        <Card key={invitation.id} padding="lg" style={styles.card}>
          <View style={styles.header}>
            <IconBubble
              icon={invitation.type === 'DEBTOR' ? 'wallet-outline' : 'people-outline'}
              tone="brand"
              size={38}
            />
            <View style={styles.headerText}>
              <Text variant="bodyStrong">{headline(invitation)}</Text>
              <Text variant="caption" color="textMuted">
                {invitation.invitedByName ? `Te invitó ${invitation.invitedByName}. ` : ''}
                Vence el {formatLongDate(invitation.expiresAt)}.
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              label="Rechazar"
              variant="ghost"
              size="sm"
              onPress={() => reject(invitation)}
              disabled={busyId !== null}
            />
            <Button
              label="Aceptar"
              size="sm"
              onPress={() => accept(invitation)}
              loading={busyId === invitation.id}
              disabled={busyId !== null && busyId !== invitation.id}
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
