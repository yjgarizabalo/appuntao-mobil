/**
 * ¿Este cliente ve su cuenta en Appuntao?
 *
 * Va en el detalle del cliente y tiene tres estados:
 *
 *  1. **Vinculado** (`debtor.isLinked`): la persona aceptó una invitación y ve
 *     lo que debe en el modo cliente. El dueño y el administrador pueden
 *     desvincularla (por ejemplo, si aceptó la persona equivocada).
 *  2. **Invitación pendiente**: se muestra a quién se envió y hasta cuándo
 *     vale, con "Reenviar" (renueva la vigencia y vuelve a abrir WhatsApp) y
 *     "Cancelar".
 *  3. **Sin invitar**: el botón que lleva a invitarlo.
 *
 * Invitar, reenviar y cancelar los pueden hacer el dueño, el administrador y
 * el cajero. A un observador solo se le muestra el estado vinculado.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatLongDate, formatPhone } from '@/core/utils/format';
import type { Debtor } from '@/domain/models';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import { shareInvitation } from '@/features/businesses/model/invitationFlow';
import { Button, Card, Dialog, IconBubble, Text, useDialog, useToast } from '@/ui';
import { theme } from '@/theme';

interface ClientAccessCardProps {
  debtor: Debtor;
  businessId: string;
  /** Si el usuario puede invitar clientes en este negocio. */
  canInvite: boolean;
  /** Si puede desvincular la ficha de la cuenta que la ve. */
  canUnlink: boolean;
  /** Tras desvincular, para que el detalle vuelva a cargar la ficha. */
  onUnlinked: () => void;
}

export const ClientAccessCard = ({
  debtor,
  businessId,
  canInvite,
  canUnlink,
  onUnlinked,
}: ClientAccessCardProps) => {
  const dialog = useDialog();
  const toast = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const firstName = debtor.name.split(' ')[0];

  const pending = useAsyncData(
    async () => {
      const list = await invitationApi.listByBusiness(businessId, {
        type: 'DEBTOR',
        status: 'PENDING',
      });
      const now = Date.now();
      return (
        list.find(
          (invitation) =>
            invitation.debtorId === debtor.id && new Date(invitation.expiresAt).getTime() > now,
        ) ?? null
      );
    },
    {
      enabled: canInvite && !debtor.isLinked,
      deps: [businessId, debtor.id, canInvite, debtor.isLinked],
    },
  );

  // Al volver de invitarlo, la invitación nueva tiene que verse.
  useFocusEffect(
    useCallback(() => {
      if (canInvite && !debtor.isLinked) void pending.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInvite, debtor.isLinked]),
  );

  const invitation = pending.data ?? null;

  const resend = async () => {
    if (!invitation) return;
    setIsBusy(true);
    try {
      const share = await invitationApi.resend(businessId, invitation.id);
      await pending.refresh();
      if (share.invitation.email && !share.invitation.phone) {
        toast.success(
          share.emailSent ? `Le reenviamos el correo a ${firstName}` : 'Invitación renovada',
        );
        return;
      }
      if (!(await shareInvitation(share))) {
        toast.info(`Comparte este código con ${firstName}: ${share.invitation.code}`);
      }
    } catch (caught) {
      dialog.showError(toAppError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const cancel = () => {
    if (!invitation) return;
    dialog.confirm({
      tone: 'danger',
      title: '¿Cancelar la invitación?',
      message: `${firstName} ya no podrá usarla. Puedes invitarlo de nuevo cuando quieras.`,
      confirmLabel: 'Cancelar invitación',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setIsBusy(true);
        try {
          await invitationApi.cancel(businessId, invitation.id);
          toast.info('Invitación cancelada');
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          await pending.refresh();
          setIsBusy(false);
        }
      },
    });
  };

  const unlink = () =>
    dialog.confirm({
      tone: 'danger',
      title: `¿Desvincular a ${firstName}?`,
      message:
        'Dejará de ver su cuenta en la app. Sus vales y abonos no cambian. Para que vuelva a verla tendrás que invitarlo de nuevo.',
      confirmLabel: 'Desvincular',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setIsBusy(true);
        try {
          await debtorApi.unlink(debtor.id, businessId);
          toast.info(`${firstName} ya no ve su cuenta en la app`);
          onUnlinked();
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          setIsBusy(false);
        }
      },
    });

  /* ── Vinculado ─────────────────────────────────────────────────────────── */

  if (debtor.isLinked) {
    return (
      <Card padding="md" style={styles.card}>
        <View style={styles.row}>
          <IconBubble icon="checkmark-circle-outline" tone="brand" size={38} />
          <View style={styles.text}>
            <Text variant="bodyStrong">Ve su cuenta en Appuntao</Text>
            <Text variant="caption" color="textMuted">
              {`${firstName} puede ver desde la app lo que te debe y sus abonos.`}
            </Text>
          </View>
        </View>
        {canUnlink ? (
          <View style={styles.actions}>
            <Button
              label="Desvincular"
              variant="ghost"
              size="sm"
              onPress={unlink}
              loading={isBusy}
            />
          </View>
        ) : null}
        <Dialog {...dialog.props} loading={isBusy} />
      </Card>
    );
  }

  if (!canInvite || pending.isLoading) return null;

  /* ── Invitación pendiente ──────────────────────────────────────────────── */

  if (invitation) {
    const sentTo = invitation.phone
      ? formatPhone(invitation.phone)
      : (invitation.email ?? 'su contacto');
    return (
      <Card padding="md" style={styles.card}>
        <View style={styles.row}>
          <IconBubble icon="time-outline" tone="warning" size={38} />
          <View style={styles.text}>
            <Text variant="bodyStrong">Invitación enviada</Text>
            <Text variant="caption" color="textMuted">
              {`A ${sentTo} · vale hasta el ${formatLongDate(invitation.expiresAt)}. Código ${invitation.code}.`}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            label="Cancelar"
            variant="ghost"
            size="sm"
            onPress={cancel}
            disabled={isBusy}
          />
          <Button
            label="Reenviar"
            size="sm"
            icon={invitation.phone ? 'logo-whatsapp' : 'mail-outline'}
            onPress={() => void resend()}
            loading={isBusy}
          />
        </View>
        <Dialog {...dialog.props} loading={isBusy} />
      </Card>
    );
  }

  /* ── Sin invitar ───────────────────────────────────────────────────────── */

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.row}>
        <IconBubble icon="wallet-outline" tone="neutral" size={38} />
        <View style={styles.text}>
          <Text variant="bodyStrong">Que vea su cuenta en la app</Text>
          <Text variant="caption" color="textMuted">
            {`Invita a ${firstName} y podrá ver lo que te debe y sus abonos desde su celular.`}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Invitar"
          size="sm"
          icon="person-add-outline"
          onPress={() =>
            router.push(
              routes.client.invite(debtor.id, businessId, {
                name: debtor.name,
                phone: debtor.phone || undefined,
              }),
            )
          }
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
});
