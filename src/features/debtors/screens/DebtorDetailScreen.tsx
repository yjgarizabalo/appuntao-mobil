/**
 * Detalle de un cliente: saldo, acciones y extracto de movimientos.
 *
 * Es la pantalla donde el tendero pasa el día, así que concentra las dos
 * acciones del negocio —fiar y cobrar— en botones grandes y siempre visibles,
 * y debajo el extracto que reemplaza al cuaderno.
 *
 * Cambios de fondo respecto al v1:
 *  - una sola petición para las deudas (ya vienen con sus pagos), en vez de
 *    una llamada extra por deuda;
 *  - el saldo se recalcula desde el servidor tras cada operación, así que no
 *    hay pagos "fantasma" en la lista local;
 *  - errores visibles: si el pago falla, el usuario se entera (en el v1 solo
 *    quedaba un `console.error`).
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatMoney, formatPhone, formatRelativeDate } from '@/core/utils/format';
import { buildDebtReminder, buildWhatsAppUrl } from '@/core/utils/whatsapp';
import type { PaymentMethod } from '@/domain/constants';
import {
  type Debt,
  type Debtor,
  buildMovements,
  summarizeDebts,
} from '@/domain/models';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { debtApi } from '@/features/debts/api/debtApi';
import { AddDebtSheet } from '@/features/debts/components/AddDebtSheet';
import { DebtDetailSheet } from '@/features/debts/components/DebtDetailSheet';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import { ClientAccessCard } from '@/features/debtors/components/ClientAccessCard';
import { MovementRow } from '@/features/debtors/components/MovementRow';
import { paymentApi } from '@/features/payments/api/paymentApi';
import { RegisterPaymentSheet } from '@/features/payments/components/RegisterPaymentSheet';
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
  useToast,
} from '@/ui';
import { theme } from '@/theme';

/** Movimientos que se muestran por página del extracto. */
const MOVEMENTS_PAGE = 15;

interface DetailData {
  debtor: Debtor;
  debts: Debt[];
}

export const DebtorDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; businessId?: string }>();
  const dialog = useDialog();
  const toast = useToast();

  const debtorId = params.id ?? '';
  const businessId = params.businessId ?? '';
  const { getBusiness, can } = useBusinesses();

  const [isDebtSheetOpen, setIsDebtSheetOpen] = useState(false);
  const [visibleMovements, setVisibleMovements] = useState(MOVEMENTS_PAGE);
  /** Deuda abierta en la hoja de detalle. */
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  /**
   * A qué se abona: `'all'` reparte entre todas las deudas (`/payments/global`)
   * y una deuda concreta abona solo a esa (`/payments`). `null` = hoja cerrada.
   */
  const [paymentTarget, setPaymentTarget] = useState<Debt | 'all' | null>(null);

  const detail = useAsyncData<DetailData>(
    async () => {
      // Las dos peticiones son independientes: se lanzan en paralelo.
      const [debtor, debts] = await Promise.all([
        debtorApi.getById(debtorId, businessId),
        debtApi.listByDebtor(debtorId, businessId),
      ]);
      return { debtor, debts };
    },
    {
      enabled: debtorId.length > 0 && businessId.length > 0,
      deps: [debtorId, businessId],
      // Al reabrir el detalle se ve el último saldo y extracto conocidos al
      // instante; si el backend gratuito está dormido, se conservan en vez de
      // mostrar un error. La caché se limpia por completo al cerrar sesión.
      cacheKey:
        debtorId && businessId ? `debtor-detail:${businessId}:${debtorId}` : undefined,
    },
  );

  const debtor = detail.data?.debtor ?? null;
  // `?? []` crearía un array nuevo en cada render y con él invalidaría los
  // memos de abajo, así que la lista también se memoiza.
  const debts = useMemo(() => detail.data?.debts ?? [], [detail.data]);

  const summary = useMemo(() => summarizeDebts(debts, debtor?.balance), [debts, debtor?.balance]);
  const movements = useMemo(() => buildMovements(debts), [debts]);

  /** Recarga tras una operación y reinicia la paginación del extracto. */
  const reloadAfterMutation = useCallback(async () => {
    setVisibleMovements(MOVEMENTS_PAGE);
    await detail.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.refresh]);

  const handleAddDebt = useCallback(
    async ({
      amount,
      description,
      dueDate,
    }: {
      amount: number;
      description: string;
      dueDate: string | undefined;
    }) => {
      try {
        await debtApi.create(businessId, { debtorId, amount, description, dueDate });
        setIsDebtSheetOpen(false);
        toast.success(`Deuda de ${formatMoney(amount)} registrada`);
        await reloadAfterMutation();
      } catch (caught) {
        setIsDebtSheetOpen(false);
        dialog.showError(toAppError(caught));
      }
    },
    [businessId, debtorId, dialog, reloadAfterMutation, toast],
  );

  const handleRegisterPayment = useCallback(
    async ({
      amount,
      method,
      note,
    }: {
      amount: number;
      method: PaymentMethod;
      note: string;
    }) => {
      const target = paymentTarget;
      if (target === null) return;

      try {
        if (target === 'all') {
          const result = await paymentApi.createGlobal(businessId, {
            debtorId,
            amount,
            method,
            note,
          });
          setPaymentTarget(null);
          // El backend reparte el abono entre las deudas abiertas, así que se
          // dice cuántas alcanzó a tocar: es la pregunta que sigue el tendero.
          toast.success(
            result.debtsAffected > 1
              ? `Pago de ${formatMoney(result.totalAmount)} repartido en ${result.debtsAffected} deudas`
              : `Pago de ${formatMoney(result.totalAmount)} registrado`,
          );
        } else {
          await paymentApi.create(businessId, { debtId: target.id, amount, method, note });
          setPaymentTarget(null);
          toast.success(`Abono de ${formatMoney(amount)} registrado`);
        }
        await reloadAfterMutation();
      } catch (caught) {
        setPaymentTarget(null);
        dialog.showError(toAppError(caught));
      }
    },
    [businessId, debtorId, dialog, paymentTarget, reloadAfterMutation, toast],
  );

  // Al volver de la pantalla de edición los datos pueden haber cambiado.
  useFocusEffect(
    useCallback(() => {
      if (debtorId && businessId) void detail.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debtorId, businessId]),
  );

  const callDebtor = useCallback(() => {
    if (!debtor?.phone) return;
    void Linking.openURL(`tel:${debtor.phone}`);
  }, [debtor?.phone]);

  /**
   * Abre WhatsApp con el cobro ya redactado. No lo envía: el tendero lo revisa
   * y pulsa enviar, que es lo que se quiere — cada cliente tiene su historia y
   * a veces conviene cambiarle una palabra antes de mandarlo.
   */
  const remindByWhatsApp = useCallback(async () => {
    if (!debtor?.phone) return;

    const url = buildWhatsAppUrl(
      debtor.phone,
      buildDebtReminder({
        debtorName: debtor.name,
        businessName: getBusiness(businessId)?.name,
        formattedBalance: formatMoney(summary.balance),
      }),
    );

    if (!url) {
      dialog.showError(
        toAppError(new Error('Este cliente no tiene un número de celular guardado.')),
      );
      return;
    }

    try {
      haptics.tap();
      await Linking.openURL(url);
    } catch (caught) {
      // Pasa si el dispositivo no sabe abrir enlaces https (raro, pero el
      // usuario merece enterarse en vez de ver que "no pasó nada").
      dialog.showError(toAppError(caught));
    }
  }, [businessId, debtor?.name, debtor?.phone, dialog, getBusiness, summary.balance]);

  /* ── Parámetros incompletos ────────────────────────────────────────────── */

  if (!debtorId || !businessId) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Cliente" />
        <EmptyState
          icon="alert-circle-outline"
          title="No pudimos abrir el cliente"
          message="Faltan datos para cargar esta pantalla. Vuelve a la lista e intenta de nuevo."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  /* ── Carga inicial ─────────────────────────────────────────────────────── */

  if (detail.isLoading) {
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

  if (detail.error || !debtor) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Cliente" />
        <ErrorState
          error={detail.error ?? toAppError(new Error('Cliente no encontrado'))}
          onRetry={detail.reload}
        />
      </Screen>
    );
  }

  const hasDebt = summary.balance > 0;
  const isOverdue = summary.oldestOverdueDate !== null && hasDebt;

  // Qué puede hacer el usuario en ESTE negocio (no siempre es el activo). Un
  // `CASHIER` fía y cobra pero no corrige clientes; un `VIEWER` solo mira.
  const canFiar = can('debt:create', businessId);
  const canPay = can('payment:create', businessId);
  const canEditDebtor = can('debtor:edit', businessId);

  return (
    <Screen
      scroll
      statusBar="light"
      refreshControl={
        <RefreshControl
          refreshing={detail.isRefreshing}
          onRefresh={detail.refresh}
          tintColor={theme.color.brand}
          colors={[theme.color.brand]}
        />
      }
      footer={
        // Un VIEWER no fía ni cobra: sin acciones, no se muestra la barra.
        canFiar || canPay ? (
          <View style={styles.actions}>
            {canFiar ? (
              <Button
                label="Fiar"
                icon="add-circle-outline"
                variant="secondary"
                onPress={() => setIsDebtSheetOpen(true)}
                size="lg"
                style={styles.actionButton}
              />
            ) : null}
            {canPay ? (
              <Button
                label="Registrar pago"
                icon="cash-outline"
                onPress={() => setPaymentTarget('all')}
                disabled={!hasDebt}
                size="lg"
                style={styles.actionButton}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      {/* ── Héroe con la identidad y el saldo ───────────────────────────── */}
      <LinearGradient
        colors={hasDebt ? theme.gradient.hero : [theme.palette.ink[900], theme.palette.brand[800]]}
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
          <View style={styles.heroActions}>
            {/* El recordatorio solo aparece si hay celular y algo que cobrar. */}
            {debtor.phone && hasDebt ? (
              <IconButton
                icon="logo-whatsapp"
                onPress={() => void remindByWhatsApp()}
                accessibilityLabel={`Recordar la deuda a ${debtor.name} por WhatsApp`}
                color={theme.color.textInverse}
                surface="inverse"
                size={20}
              />
            ) : null}
            {debtor.phone ? (
              <IconButton
                icon="call-outline"
                onPress={callDebtor}
                accessibilityLabel={`Llamar a ${debtor.name}`}
                color={theme.color.textInverse}
                surface="inverse"
                size={20}
              />
            ) : null}
            {/*
              Editar solo lo ven el dueño y el administrador (un cajero recibe
              403 en el backend). Se oculta en vez de dejar intentar y fallar.
            */}
            {canEditDebtor ? (
              <IconButton
                icon="create-outline"
                onPress={() => router.push(routes.client.edit(debtorId, businessId))}
                accessibilityLabel={`Editar los datos de ${debtor.name}`}
                color={theme.color.textInverse}
                surface="inverse"
                size={20}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.identity}>
          <Avatar name={debtor.name} size="xl" />
          <Text variant="title2" color="textInverse" align="center" numberOfLines={2}>
            {debtor.name}
          </Text>
          <Text variant="caption" color="textInverseSubtle">
            {debtor.documentType} {debtor.documentNumber}
            {debtor.phone ? ` · ${formatPhone(debtor.phone)}` : ''}
          </Text>
        </View>

        <View style={styles.heroBalance}>
          <Text variant="caption" color="textInverseMuted">
            {hasDebt ? 'Saldo pendiente' : 'Sin deudas pendientes'}
          </Text>
          <AnimatedMoney value={summary.balance} color="textInverse" />

          {isOverdue ? (
            <Badge
              label={`Venció ${formatRelativeDate(summary.oldestOverdueDate).toLowerCase()}`}
              tone="danger"
              icon="time-outline"
              size="md"
            />
          ) : hasDebt ? (
            <Badge
              label={`${summary.openDebts} ${summary.openDebts === 1 ? 'deuda abierta' : 'deudas abiertas'}`}
              tone="warning"
              size="md"
            />
          ) : (
            <Badge label="Al día" tone="success" icon="checkmark-circle" size="md" />
          )}
        </View>

        <View style={styles.stats}>
          <StatTile
            label="Total fiado"
            value={formatMoney(summary.totalDebt)}
            icon="arrow-up-outline"
            inverse
          />
          <StatTile
            label="Total pagado"
            value={formatMoney(summary.totalPaid)}
            icon="arrow-down-outline"
            inverse
          />
        </View>
      </LinearGradient>

      {/* ── Extracto ────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <StaleNotice visible={detail.isStale} />

        {/* Si el cliente ve su cuenta en la app, o invitarlo a verla. */}
        <ClientAccessCard
          debtor={debtor}
          businessId={businessId}
          canInvite={can('client:invite', businessId)}
          canUnlink={can('client:unlink', businessId)}
          onUnlinked={() => void detail.refresh()}
        />

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
            message={
              canFiar
                ? `Aún no le has fiado nada a ${debtor.name.split(' ')[0]}. Empieza con el botón "Fiar".`
                : `Todavía no hay movimientos registrados para ${debtor.name.split(' ')[0]}.`
            }
            tone="brand"
          />
        ) : (
          <Card padding="md" elevation="flat">
            {movements.slice(0, visibleMovements).map((movement, index) => (
              <View key={movement.id}>
                {index > 0 ? <Divider /> : null}
                <MovementRow
                  movement={movement}
                  onPress={
                    movement.kind === 'debt'
                      ? () => setSelectedDebt(movement.debt)
                      : undefined
                  }
                />
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
                <Ionicons name="chevron-down" size={15} color={theme.color.brandStrong} />
              </PressableScale>
            ) : null}
          </Card>
        )}
      </View>

      <AddDebtSheet
        visible={isDebtSheetOpen}
        onClose={() => setIsDebtSheetOpen(false)}
        debtorName={debtor.name}
        onSubmit={handleAddDebt}
      />

      {/* La hoja de la deuda se retira en cuanto se va a cobrar: dos `Modal`
          montados a la vez (uno saliendo, otro entrando) dejan al de Android
          sin aparecer. La de pago sí permanece montada, para que al cerrarla
          se deslice hacia abajo en vez de desaparecer de golpe. */}
      {paymentTarget === null ? (
        <DebtDetailSheet
          visible={selectedDebt !== null}
          onClose={() => setSelectedDebt(null)}
          debt={selectedDebt}
          onRegisterPayment={(debt) => {
            setSelectedDebt(null);
            setPaymentTarget(debt);
          }}
        />
      ) : null}

      <RegisterPaymentSheet
        visible={paymentTarget !== null}
        onClose={() => setPaymentTarget(null)}
        debtorName={debtor.name}
        balance={
          paymentTarget === null || paymentTarget === 'all'
            ? summary.balance
            : paymentTarget.remainingAmount
        }
        target={
          paymentTarget === null || paymentTarget === 'all'
            ? undefined
            : paymentTarget.description || 'esta deuda'
        }
        onSubmit={handleRegisterPayment}
      />

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
  },
  identity: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
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
    paddingTop: theme.spacing.md,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.color.border,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  skeletonList: {
    marginTop: theme.spacing.xl,
  },
});
