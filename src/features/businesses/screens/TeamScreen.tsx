/**
 * Equipo del negocio activo: quién tiene acceso y con qué rol.
 *
 * Es una lista Tier B, hermana de Clientes y Negocios: `AppBar` + `FlatList` de
 * `MemberRow` + `Fab`. Cualquier miembro puede ver el equipo (el backend deja
 * leer `GET /business-users` a todos los roles); solo el dueño o un
 * administrador ven el `Fab` de invitar y pueden gestionar a otros. El dueño no
 * se puede modificar ni quitar, y uno no se gestiona a sí mismo: en esos casos
 * la fila no es accionable.
 */
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { BUSINESS_ROLE_LABEL, type BusinessRole } from '@/domain/constants';
import { formatLongDate, formatPhone } from '@/core/utils/format';
import type { Invitation, Member } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { memberApi } from '@/features/businesses/api/memberApi';
import { MemberActionsSheet } from '@/features/businesses/components/MemberActionsSheet';
import { MemberRow } from '@/features/businesses/components/MemberRow';
import { shareInvitation } from '@/features/businesses/model/invitationFlow';
import {
  useBusinesses,
  useRefreshBusinessesOnFocus,
} from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  Badge,
  Dialog,
  EmptyState,
  ErrorState,
  Fab,
  IconBubble,
  ListRow,
  ListSkeleton,
  Screen,
  SectionHeader,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const TeamScreen = () => {
  const { user } = useSession();
  const { activeBusiness, activeBusinessId, can, refresh: refreshBusinesses } = useBusinesses();
  useRefreshBusinessesOnFocus();
  const dialog = useDialog();
  const toast = useToast();

  const canInvite = can('member:invite');
  const canManage = can('member:manage');
  const canRemove = can('member:remove');

  /**
   * El miembro de la hoja y si la hoja está abierta van por separado: al
   * cerrarla, el miembro se conserva hasta que termina la animación, para que
   * el título no quede en blanco mientras baja.
   */
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  /** Quitar se confirma cuando la hoja ya cerró (ver `handleSheetClosed`). */
  const pendingRemovalRef = useRef<Member | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const members = useAsyncData<Member[]>(
    () => memberApi.listByBusiness(activeBusinessId as string),
    {
      enabled: Boolean(activeBusinessId),
      deps: [activeBusinessId],
      cacheKey: activeBusinessId ? `team-members:${activeBusinessId}` : undefined,
    },
  );

  // Las invitaciones pendientes solo las puede listar un ADMIN/OWNER.
  const invitations = useAsyncData(
    () => invitationApi.listByBusiness(activeBusinessId as string),
    {
      enabled: Boolean(activeBusinessId) && canInvite,
      deps: [activeBusinessId, canInvite],
    },
  );

  const pendingInvites = (invitations.data ?? []).filter(
    (invitation) => invitation.type === 'BUSINESS_USER' && invitation.status === 'PENDING',
  );

  const reloadAll = useCallback(async () => {
    // Solo un ADMIN/OWNER puede listar invitaciones; un cajero pediría y
    // recibiría un 403 inútil, así que ese refresh se omite para él.
    const tasks = [members.refresh(), refreshBusinesses()];
    if (canInvite) tasks.push(invitations.refresh());
    await Promise.all(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.refresh, invitations.refresh, refreshBusinesses, canInvite]);

  const handleChangeRole = useCallback(
    async (role: BusinessRole) => {
      const target = selectedMember;
      if (!target || !activeBusinessId) return;
      setIsBusy(true);
      try {
        await memberApi.updateRole(activeBusinessId, target.id, role);
        setIsSheetOpen(false);
        toast.success(`${target.name.split(' ')[0]} ahora es ${BUSINESS_ROLE_LABEL[role]}`);
        await reloadAll();
      } catch (caught) {
        dialog.showError(toAppError(caught));
      } finally {
        setIsBusy(false);
      }
    },
    [activeBusinessId, dialog, reloadAll, selectedMember, toast],
  );

  const confirmRemoval = useCallback(
    (target: Member) => {
      if (!activeBusinessId) return;
      dialog.confirm({
      tone: 'danger',
        title: `¿Quitar a ${target.name.split(' ')[0]}?`,
        message: 'Perderá el acceso a este negocio. Puedes volver a invitarlo cuando quieras.',
        confirmLabel: 'Quitar',
        onConfirm: async () => {
          setIsBusy(true);
          try {
            await memberApi.remove(activeBusinessId, target.id);
            toast.success(`${target.name.split(' ')[0]} fue quitado del negocio`);
            await reloadAll();
          } catch (caught) {
            dialog.showError(toAppError(caught));
          } finally {
            setIsBusy(false);
          }
        },
      });
    },
    [activeBusinessId, dialog, reloadAll, toast],
  );

  /** "Quitar del negocio": primero se cierra la hoja; la confirmación sigue al cerrar. */
  const handleRemove = useCallback(() => {
    if (!selectedMember) return;
    pendingRemovalRef.current = selectedMember;
    setIsSheetOpen(false);
  }, [selectedMember]);

  const handleSheetClosed = useCallback(() => {
    setSelectedMember(null);
    const target = pendingRemovalRef.current;
    pendingRemovalRef.current = null;
    if (target) confirmRemoval(target);
  }, [confirmRemoval]);

  /**
   * Tocar una invitación pendiente: reenviarla (renueva 7 días, mismo código,
   * y vuelve a abrir WhatsApp si va a un celular) o cancelarla.
   */
  const handleInvitation = (invitation: Invitation) => {
    if (!activeBusinessId) return;
    const target = invitation.email ?? (invitation.phone ? formatPhone(invitation.phone) : '');
    dialog.confirm({
      tone: 'info',
      title: target ? `Invitación a ${target}` : 'Invitación pendiente',
      message: `Vale hasta el ${formatLongDate(invitation.expiresAt)}. Código ${invitation.code}.`,
      confirmLabel: 'Reenviar',
      cancelLabel: 'Cancelar invitación',
      onConfirm: async () => {
        setIsBusy(true);
        try {
          const share = await invitationApi.resend(activeBusinessId, invitation.id);
          if (share.invitation.phone) {
            if (!(await shareInvitation(share))) {
              toast.info(`Comparte este código: ${share.invitation.code}`);
            }
          } else {
            toast.success(share.emailSent ? 'Le reenviamos el correo' : 'Invitación renovada');
          }
          await invitations.refresh();
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          setIsBusy(false);
        }
      },
      onCancel: () =>
        // El diálogo se cierra antes; la confirmación entra justo después.
        setTimeout(
          () =>
            dialog.confirm({
              tone: 'danger',
              title: '¿Cancelar la invitación?',
              message: 'Ya no se podrá usar. Puedes invitar a esa persona de nuevo cuando quieras.',
              confirmLabel: 'Cancelar invitación',
              cancelLabel: 'Volver',
              onConfirm: async () => {
                setIsBusy(true);
                try {
                  await invitationApi.cancel(activeBusinessId, invitation.id);
                  toast.info('Invitación cancelada');
                } catch (caught) {
                  dialog.showError(toAppError(caught));
                } finally {
                  await invitations.refresh();
                  setIsBusy(false);
                }
              },
            }),
          300,
        ),
    });
  };

  /** Una fila es accionable si puedo gestionar, no es el dueño y no soy yo. */
  const canManageMember = (member: Member) =>
    (canManage || canRemove) && member.role !== 'OWNER' && member.userId !== user?.id;

  /* ── Sin negocio todavía ───────────────────────────────────────────────── */

  if (!activeBusinessId) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Equipo" />
        <EmptyState
          icon="people-outline"
          title="Primero elige un negocio"
          message="El equipo es de cada negocio. Crea o selecciona uno para ver quién tiene acceso."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        onBack={() => router.back()}
        title="Equipo"
        subtitle={activeBusiness ? `Quién tiene acceso a ${activeBusiness.name}` : undefined}
      />

      {members.isLoading && (members.data ?? []).length === 0 ? (
        <View style={styles.skeletonHost}>
          <ListSkeleton count={4} />
        </View>
      ) : members.error && (members.data ?? []).length === 0 ? (
        <ErrorState error={members.error} onRetry={members.reload} />
      ) : (
        <FlatList
          data={members.data ?? []}
          keyExtractor={(member) => member.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={members.isRefreshing}
              onRefresh={reloadAll}
              tintColor={theme.color.brand}
              colors={[theme.color.brand]}
            />
          }
          renderItem={({ item: member }) => (
            <MemberRow
              member={member}
              isCurrentUser={member.userId === user?.id}
              onPress={
                canManageMember(member)
                  ? () => {
                      setSelectedMember(member);
                      setIsSheetOpen(true);
                    }
                  : undefined
              }
            />
          )}
          ListFooterComponent={
            pendingInvites.length > 0 ? (
              <View style={styles.pending}>
                <SectionHeader title="Invitaciones pendientes" meta={`${pendingInvites.length}`} />
                {pendingInvites.map((invitation) => (
                  <View key={invitation.id} style={styles.pendingRow}>
                    <ListRow
                      leading={<IconBubble icon="mail-outline" tone="warning" />}
                      title={invitation.email ?? invitation.phone ?? invitation.code}
                      subtitle={
                        invitation.role
                          ? `Invitado como ${BUSINESS_ROLE_LABEL[invitation.role]}`
                          : 'Invitación enviada'
                      }
                      trailing={<Badge label="Pendiente" tone="warning" />}
                      onPress={() => handleInvitation(invitation)}
                    />
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Trabajas solo por ahora"
              message="Invita a un cajero o administrador para que te ayude a llevar los vales."
              actionLabel={canInvite ? 'Invitar' : undefined}
              onAction={canInvite ? () => router.push(routes.team.invite) : undefined}
              tone="brand"
            />
          }
        />
      )}

      {canInvite ? (
        <Fab label="Invitar" icon="person-add-outline" onPress={() => router.push(routes.team.invite)} />
      ) : null}

      <MemberActionsSheet
        member={selectedMember}
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onClosed={handleSheetClosed}
        canManageRole={canManage}
        canRemove={canRemove}
        onChangeRole={handleChangeRole}
        onRemove={handleRemove}
        isBusy={isBusy}
      />

      <Dialog {...dialog.props} loading={isBusy} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  skeletonHost: {
    paddingHorizontal: theme.layout.gutter,
  },
  listContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: 120,
    flexGrow: 1,
  },
  separator: {
    height: theme.spacing.sm,
  },
  pending: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  pendingRow: {
    marginBottom: theme.spacing.sm,
  },
});
