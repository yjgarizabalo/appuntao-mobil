/**
 * Pasarle la propiedad de un negocio a un miembro de su equipo.
 *
 * Es una **propuesta**: el miembro la acepta o la rechaza desde su app y tiene
 * un plazo para hacerlo. Ser dueño implica responder por el negocio y por los
 * datos de sus clientes, así que nadie se vuelve dueño sin aceptarlo. Al
 * aceptar, el dueño actual queda como administrador.
 *
 * Solo el dueño entra aquí (la ruta llega desde el perfil o desde "Eliminar
 * cuenta"). Si ya hay una propuesta vigente se muestra con la opción de
 * cancelarla, porque el backend admite una sola por negocio.
 *
 * Debajo van las **últimas propuestas ya resueltas** (hasta 3): así el dueño
 * sabe si el miembro rechazó, si venció sin respuesta o si la canceló él. El
 * backend también le avisa por correo cuando el miembro responde.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { formatLongDate } from '@/core/utils/format';
import { BUSINESS_ROLE_LABEL } from '@/domain/constants';
import type { OwnershipTransfer, OwnershipTransferStatus } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { memberApi } from '@/features/businesses/api/memberApi';
import { ownershipApi } from '@/features/businesses/api/ownershipApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  IconBubble,
  ListRow,
  ListSkeleton,
  Screen,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

/** Cómo se lee cada desenlace en el historial. */
const OUTCOME: Record<
  Exclude<OwnershipTransferStatus, 'PENDING'>,
  { label: string; tone: BadgeTone; verb: (name: string) => string }
> = {
  ACCEPTED: { label: 'Aceptada', tone: 'success', verb: (name) => `${name} aceptó` },
  REJECTED: { label: 'Rechazada', tone: 'danger', verb: (name) => `${name} rechazó` },
  EXPIRED: { label: 'Vencida', tone: 'warning', verb: (name) => `${name} no respondió a tiempo` },
  CANCELLED: { label: 'Cancelada', tone: 'neutral', verb: () => 'Se canceló' },
};

const HistoryRow = ({ transfer }: { transfer: OwnershipTransfer }) => {
  if (transfer.status === 'PENDING') return null;
  const outcome = OUTCOME[transfer.status];
  const name = transfer.toName.split(' ')[0] || 'El miembro';
  const when = formatLongDate(transfer.respondedAt ?? transfer.expiresAt);
  return (
    <ListRow
      leading={<Avatar name={transfer.toName || 'Miembro'} />}
      title={transfer.toName || 'Miembro'}
      subtitle={when ? `${outcome.verb(name)} el ${when}` : outcome.verb(name)}
      trailing={<Badge label={outcome.label} tone={outcome.tone} />}
    />
  );
};

export const TransferOwnershipScreen = () => {
  const params = useLocalSearchParams<{ businessId?: string }>();
  const businessId = typeof params.businessId === 'string' ? params.businessId : '';

  const { user } = useSession();
  const { getBusiness } = useBusinesses();
  const business = businessId ? getBusiness(businessId) : undefined;
  const dialog = useDialog();
  const toast = useToast();

  const pending = useAsyncData(() => ownershipApi.pending(businessId), {
    enabled: Boolean(businessId),
    deps: [businessId],
  });
  const members = useAsyncData(() => memberApi.listByBusiness(businessId), {
    enabled: Boolean(businessId),
    deps: [businessId],
  });
  // El historial es complementario: si falla, simplemente no se muestra.
  const history = useAsyncData(() => ownershipApi.history(businessId), {
    enabled: Boolean(businessId),
    deps: [businessId],
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const candidates = (members.data ?? []).filter(
    (member) => member.role !== 'OWNER' && member.userId !== user?.id,
  );
  const selected = candidates.find((member) => member.userId === selectedUserId) ?? null;
  const businessName = business?.name ?? 'tu negocio';

  const submit = async () => {
    if (!selected) return;
    if (!password) {
      setPasswordError('Escribe tu contraseña para confirmar');
      return;
    }

    setIsBusy(true);
    try {
      await ownershipApi.request(businessId, selected.userId, password);
      haptics.success();
      toast.success(`Le enviamos la propuesta a ${selected.name.split(' ')[0]}`);
      setPassword('');
      setSelectedUserId(null);
      await Promise.all([pending.reload(), history.reload()]);
    } catch (caught) {
      const error = toAppError(caught);
      if (error.code === 'CONFLICT') {
        // Ya había una propuesta (por ejemplo, desde otro teléfono).
        await pending.reload();
        dialog.showError(error);
        return;
      }
      // Un 400 puede ser la contraseña o que la persona ya no está en el
      // equipo: el mensaje del backend dice cuál, así que va en un diálogo en
      // vez de adivinar el campo por el texto.
      dialog.showError(error);
    } finally {
      setIsBusy(false);
    }
  };

  const cancelTransfer = () =>
    dialog.confirm({
      tone: 'warning',
      title: '¿Cancelar la propuesta?',
      message: 'El negocio sigue siendo tuyo. Puedes proponérselo a alguien más después.',
      confirmLabel: 'Cancelar propuesta',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setIsBusy(true);
        try {
          await ownershipApi.cancel(businessId);
          toast.success('Propuesta cancelada');
          await Promise.all([pending.reload(), history.reload()]);
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          setIsBusy(false);
        }
      },
    });

  /* ── Cuerpo según el estado ───────────────────────────────────────────── */

  const isLoading = pending.isLoading || members.isLoading;
  const loadError = pending.error ?? members.error;
  const transfer = pending.data;

  let body;
  let footer;
  /** El historial solo se muestra cuando lo demás cargó bien. */
  let showHistory = false;

  if (!businessId || (business && business.ownerId && business.ownerId !== user?.id)) {
    body = (
      <EmptyState
        icon="storefront-outline"
        title="Solo el dueño puede hacer esto"
        message="La propiedad de un negocio solo la puede pasar quien es su dueño."
      />
    );
  } else if (isLoading) {
    body = <ListSkeleton count={3} />;
  } else if (loadError) {
    body = (
      <ErrorState
        error={loadError}
        onRetry={() => {
          void pending.reload();
          void members.reload();
        }}
      />
    );
  } else if (transfer) {
    showHistory = true;
    body = (
      <Card padding="lg" style={styles.pendingCard}>
        <View style={styles.pendingHeader}>
          <Ionicons name="time-outline" size={20} color={theme.color.warning} />
          <Text variant="bodyStrong">Propuesta enviada</Text>
        </View>
        <Text variant="body" color="textMuted">
          Le propusiste {businessName} a {transfer.toName || 'un miembro'}. Tiene hasta el{' '}
          {formatLongDate(transfer.expiresAt)} para aceptar o rechazar. Mientras tanto, el
          negocio sigue siendo tuyo.
        </Text>
      </Card>
    );
    footer = (
      <Button
        label="Cancelar propuesta"
        variant="secondary"
        onPress={cancelTransfer}
        loading={isBusy}
        size="lg"
        fullWidth
      />
    );
  } else if (!candidates.length) {
    showHistory = true;
    body = (
      <EmptyState
        icon="people-outline"
        title="No hay a quién pasárselo"
        message="Solo puedes pasarle el negocio a alguien de tu equipo. Invita primero a la persona que lo va a recibir."
      />
    );
  } else {
    showHistory = true;
    body = (
      <>
        <Text variant="overline" color="textSubtle" uppercase style={styles.groupLabel}>
          ¿A quién?
        </Text>
        <View style={styles.list}>
          {candidates.map((member) => {
            const isSelected = member.userId === selectedUserId;
            return (
              <ListRow
                key={member.id}
                leading={<Avatar name={member.name} />}
                title={member.name}
                subtitle={BUSINESS_ROLE_LABEL[member.role]}
                onPress={() => {
                  haptics.select();
                  setSelectedUserId(member.userId);
                }}
                trailing={
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? theme.color.brand : theme.color.textSubtle}
                  />
                }
              />
            );
          })}
        </View>

        <TextField
          label="Tu contraseña"
          placeholder="Para confirmar que eres tú"
          icon="key-outline"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (value) setPasswordError(undefined);
          }}
          error={passwordError}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          containerStyle={styles.password}
        />
      </>
    );
    footer = (
      <Button
        label={selected ? `Proponérselo a ${selected.name.split(' ')[0]}` : 'Elige a alguien'}
        onPress={submit}
        loading={isBusy}
        disabled={!selected || !password}
        size="lg"
        fullWidth
      />
    );
  }

  return (
    <Screen scroll padded keyboardAware footer={footer}>
      <AppBar onBack={() => router.back()} title="Pasar el negocio" />

      <IconBubble icon="swap-horizontal-outline" tone="brand" size={56} />
      <Text variant="title2" style={styles.title}>
        Pásale {businessName} a alguien de tu equipo
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Será el dueño cuando acepte, y tú quedarás como administrador. Tiene 7 días para
        responder.
      </Text>

      {body}

      {showHistory && history.data?.length ? (
        <>
          <Text variant="overline" color="textSubtle" uppercase style={styles.historyLabel}>
            Últimas propuestas
          </Text>
          <View style={styles.list}>
            {history.data.map((item) => (
              <HistoryRow key={item.id} transfer={item} />
            ))}
          </View>
        </>
      ) : null}

      <Dialog {...dialog.props} loading={isBusy} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  groupLabel: {
    marginBottom: theme.spacing.sm,
  },
  historyLabel: {
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.sm,
  },
  password: {
    marginTop: theme.spacing.xl,
  },
  pendingCard: {
    gap: theme.spacing.sm,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});
