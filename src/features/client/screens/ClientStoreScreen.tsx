/**
 * La cuenta del cliente en una tienda: saldo y extracto.
 *
 * Es el reflejo de `DebtorDetailScreen`, la pantalla donde el tendero mira la
 * cuenta de su cliente. Misma estructura —héroe con el saldo, dos cifras de
 * apoyo y el extracto debajo— para que un tendero que cambia de modo reconozca
 * de inmediato lo que está viendo, solo que desde el otro lado: lo que allá es
 * "total fiado" aquí es "te han fiado".
 *
 * Es de **solo lectura** a propósito. Quien mueve un saldo es siempre el
 * tendero; si el cliente pudiera registrar su propio abono, el cuaderno
 * dejaría de ser una sola verdad. Por eso la única acción es escribirle a la
 * tienda por WhatsApp para coordinar el pago.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { formatMoney, formatRelativeDate } from '@/core/utils/format';
import { buildPaymentNotice, buildWhatsAppShareUrl } from '@/core/utils/whatsapp';
import {
  type ClientAccount,
  type ClientStanding,
  buildClientMovements,
  displayName,
} from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { clientApi } from '@/features/client/api/clientApi';
import { ClientMovementRow } from '@/features/client/components/ClientMovementRow';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import {
  AnimatedMoney,
  AppBar,
  Avatar,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PressableScale,
  Screen,
  SectionHeader,
  StaleNotice,
  StatTile,
  Text,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

/** Cuántos movimientos se pintan de entrada, y de cuántos en cuántos crece. */
const MOVEMENTS_PAGE = 15;

export const ClientStoreScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { accounts } = useAppMode();
  const dialog = useDialog();

  const params = useLocalSearchParams<{ id?: string; businessId?: string }>();
  const debtorId = params.id;
  const businessId = params.businessId;

  const [visibleMovements, setVisibleMovements] = useState(MOVEMENTS_PAGE);

  /**
   * La ficha sale de los vínculos que ya cargó `AppModeProvider`. El respaldo
   * solo entra si se llega aquí por un enlace directo antes de que terminen de
   * cargar: con el id basta para pedir las deudas, y el nombre se queda
   * genérico en vez de dejar la pantalla en blanco.
   */
  const account = useMemo<ClientAccount | null>(() => {
    if (!debtorId || !businessId) return null;
    return (
      accounts.find(
        (item) => item.debtorId === debtorId && item.businessId === businessId,
      ) ?? {
        debtorId,
        businessId,
        // Vacío a propósito: no se sabe con qué nombre lo registró la tienda y
        // suponer el de su cuenta sería inventarlo. La línea no se pinta.
        debtorName: '',
        businessName: 'Tienda',
      }
    );
  }, [accounts, businessId, debtorId]);

  const standing = useAsyncData<ClientStanding | null>(
    async () => (account ? clientApi.getStanding(account) : null),
    {
      enabled: Boolean(account),
      deps: [account?.debtorId, account?.businessId],
      cacheKey:
        user?.id && debtorId && businessId
          ? `client-store:${user.id}:${businessId}:${debtorId}`
          : undefined,
    },
  );

  const summary = standing.data?.summary;
  const balance = summary?.balance ?? 0;
  const hasDebt = balance > 0;

  const movements = useMemo(
    () => (standing.data ? buildClientMovements([standing.data]) : []),
    [standing.data],
  );

  /**
   * Abre WhatsApp con el mensaje escrito y **sin** destinatario: el API no le
   * da al cliente el teléfono de la tienda (ver `buildWhatsAppShareUrl`), así
   * que elige el contacto él mismo.
   */
  const contactStore = useCallback(async () => {
    if (!account) return;

    const message = buildPaymentNotice({
      clientName: displayName(user),
      businessName: account.businessName,
      formattedBalance: formatMoney(balance),
    });

    try {
      haptics.press();
      await Linking.openURL(buildWhatsAppShareUrl(message));
    } catch (caught) {
      dialog.showError(toAppError(caught));
    }
  }, [account, balance, dialog, user]);

  /* ── Parámetros incompletos ────────────────────────────────────────────── */

  if (!debtorId || !businessId) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Tienda" />
        <EmptyState
          icon="alert-circle-outline"
          title="No pudimos abrir la tienda"
          message="Faltan datos para cargar esta pantalla. Vuelve a tus tiendas e intenta de nuevo."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  /* ── Carga y error ─────────────────────────────────────────────────────── */

  if (standing.isLoading) {
    return (
      <Screen padded>
        <AppBar onBack={() => router.back()} />
        <CardSkeleton height={230} />
        <View style={styles.skeletonList}>
          <ListSkeleton count={4} />
        </View>
      </Screen>
    );
  }

  if (standing.error || !standing.data || !summary) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Tienda" />
        <ErrorState
          error={standing.error ?? toAppError(new Error('No se pudo cargar la tienda'))}
          onRetry={standing.reload}
        />
      </Screen>
    );
  }

  // Se lee del vínculo vivo y no de `standing.data.account`: ese quedó
  // capturado al momento de pedir las deudas y, si entonces todavía no habían
  // cargado los vínculos, conservaría el nombre genérico del respaldo.
  const storeName = account?.businessName ?? standing.data.account.businessName;
  const registeredAs = account?.debtorName || standing.data.account.debtorName;
  const isOverdue = summary.oldestOverdueDate !== null && hasDebt;

  return (
    <Screen
      scroll
      statusBar="light"
      refreshControl={
        <RefreshControl
          refreshing={standing.isRefreshing}
          onRefresh={standing.refresh}
          tintColor={theme.color.brand}
          colors={[theme.color.brand]}
        />
      }
      footer={
        hasDebt ? (
          <Button
            label="Coordinar el pago"
            icon="logo-whatsapp"
            onPress={() => void contactStore()}
            size="lg"
            fullWidth
          />
        ) : undefined
      }
    >
      {/* ── Héroe con el saldo en esta tienda ───────────────────────────── */}
      <LinearGradient
        colors={
          hasDebt ? theme.gradient.hero : [theme.palette.ink[900], theme.palette.brand[800]]
        }
        style={[styles.hero, { paddingTop: insets.top + theme.spacing.xs }]}
      >
        <View style={styles.heroBar}>
          <IconButton
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            color={theme.color.textInverse}
            surface="inverse"
            size={24}
          />
          {hasDebt ? (
            <IconButton
              icon="logo-whatsapp"
              onPress={() => void contactStore()}
              accessibilityLabel={`Escribirle a ${storeName} por WhatsApp`}
              color={theme.color.textInverse}
              surface="inverse"
              size={20}
            />
          ) : null}
        </View>

        <View style={styles.identity}>
          <Avatar name={storeName} size="xl" />
          <Text variant="title2" color="textInverse" align="center" numberOfLines={2}>
            {storeName}
          </Text>
          {registeredAs ? (
            <Text variant="caption" color="textInverseSubtle" numberOfLines={1}>
              Te registraron como {registeredAs}
            </Text>
          ) : null}
        </View>

        <View style={styles.heroBalance}>
          <Text variant="caption" color="textInverseMuted">
            {hasDebt ? 'Le debes' : 'No le debes nada'}
          </Text>
          <AnimatedMoney value={balance} color="textInverse" />

          {isOverdue ? (
            <Badge
              label={`Venció ${formatRelativeDate(summary.oldestOverdueDate).toLowerCase()}`}
              tone="danger"
              icon="time-outline"
              size="md"
            />
          ) : hasDebt ? (
            <Badge
              label={`${summary.openDebts} ${summary.openDebts === 1 ? 'vale abierto' : 'vales abiertos'}`}
              tone="warning"
              size="md"
            />
          ) : (
            <Badge label="Al día" tone="success" icon="checkmark-circle" size="md" />
          )}
        </View>

        <View style={styles.stats}>
          <StatTile
            label="Te han fiado"
            value={formatMoney(summary.totalDebt)}
            icon="arrow-up-outline"
            inverse
          />
          <StatTile
            label="Has abonado"
            value={formatMoney(summary.totalPaid)}
            icon="arrow-down-outline"
            inverse
          />
        </View>
      </LinearGradient>

      {/* ── Extracto ────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <StaleNotice visible={standing.isStale} />

        <SectionHeader
          title="Movimientos"
          meta={
            movements.length > 0
              ? `${movements.length} ${movements.length === 1 ? 'registro' : 'registros'}`
              : undefined
          }
        />

        {movements.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Sin movimientos"
            message={`${storeName} todavía no te ha registrado ningún vale.`}
            tone="brand"
          />
        ) : (
          <Card padding="md" elevation="flat">
            {movements.slice(0, visibleMovements).map((row, index) => (
              <View key={row.movement.id}>
                {index > 0 ? <Divider /> : null}
                <ClientMovementRow row={row} hideStore />
              </View>
            ))}

            {movements.length > visibleMovements ? (
              <PressableScale
                onPress={() => setVisibleMovements((current) => current + MOVEMENTS_PAGE)}
                haptic="tap"
                style={styles.loadMore}
                accessibilityRole="button"
                accessibilityLabel="Ver más movimientos"
              >
                <Text variant="captionStrong" color="brandStrong">
                  Ver {Math.min(MOVEMENTS_PAGE, movements.length - visibleMovements)} más
                </Text>
              </PressableScale>
            ) : null}
          </Card>
        )}
      </View>

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius['3xl'],
    borderBottomRightRadius: theme.radius['3xl'],
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  identity: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  heroBalance: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  body: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.lg,
  },
  skeletonList: {
    marginTop: theme.spacing.xl,
  },
  loadMore: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
});
