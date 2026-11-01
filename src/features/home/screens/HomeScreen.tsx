/**
 * Inicio.
 *
 * El v1 mostraba un banner de bienvenida y dos tarjetas de navegación: bonito,
 * pero sin información. Un tendero abre la app para saber **cuánto le deben** y
 * **quién le debe**, así que esta pantalla responde eso en el primer pantallazo:
 *
 *  1. héroe oscuro con el total por cobrar del negocio activo;
 *  2. dos cifras de apoyo (clientes con deuda / clientes al día);
 *  3. accesos rápidos a las acciones frecuentes;
 *  4. los clientes que más deben, listos para tocar y cobrar.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { getFirstName, pluralize } from '@/core/utils/format';
import { type BusinessSummary, displayName } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { BusinessSwitcher } from '@/features/businesses/components/BusinessSwitcher';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { ModeSwitcher } from '@/features/client/components/ModeSwitcher';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import { DebtorRow } from '@/features/debtors/components/DebtorRow';
import {
  AnimatedMoney,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconBubble,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  StaleNotice,
  Text,
} from '@/ui';
import { theme } from '@/theme';

/** Cuántos clientes con deuda se listan en el inicio; el ranking lo arma el servidor. */
const TOP_DEBTORS = 5;

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const {
    activeBusinessId,
    activeBusiness,
    isEmpty: hasNoBusiness,
    error: businessError,
    refresh: refreshBusinesses,
  } = useBusinesses();
  const { setMode } = useAppMode();

  /**
   * Los totales los calcula el servidor. Antes se pedía una página de 100
   * clientes y se sumaba aquí, pero el backend tope el `limit` en 100: a
   * partir de ese número el "total por cobrar" salía corto y nada lo avisaba.
   * De paso el ranking viene ordenado por saldo desde la base de datos, así
   * que un moroso antiguo ya no se queda fuera por no caber en la página.
   */
  const debtors = useAsyncData<BusinessSummary | null>(
    async () => {
      if (!activeBusinessId) return null;
      return debtorApi.getSummary(activeBusinessId, TOP_DEBTORS);
    },
    {
      enabled: Boolean(activeBusinessId),
      deps: [activeBusinessId],
      // Se cachea por usuario + negocio: al reabrir la app se ve el último total
      // por cobrar al instante aunque el backend gratuito esté despertando.
      cacheKey:
        user?.id && activeBusinessId ? `home-summary:${user.id}:${activeBusinessId}` : undefined,
    },
  );

  // Al volver de registrar un pago o una deuda, el resumen debe estar al día.
  useFocusEffect(
    useCallback(() => {
      if (activeBusinessId) void debtors.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBusinessId]),
  );

  const summary = useMemo(() => {
    const data = debtors.data;

    return {
      total: data?.totalBalance ?? 0,
      withDebtCount: data?.debtorsWithDebt ?? 0,
      clearCount: data?.debtorsClear ?? 0,
      topDebtors: data?.topDebtors ?? [],
      isEmpty: (data?.totalDebtors ?? 0) === 0,
    };
  }, [debtors.data]);

  const greeting = `Hola, ${getFirstName(displayName(user)) || 'Usuario'}`;

  /* ── No se pudo cargar la lista de negocios ────────────────────────────── */

  /*
   * Antes de afirmar que no hay negocios hay que poder afirmarlo: si la lista
   * no cargó —sin internet, o el servidor dormido— `businesses` queda vacío
   * igual que si el usuario no tuviera ninguno, y la app le proponía crear uno
   * que ya tiene. `ErrorState` se encarga de distinguir el caso: si el
   * dispositivo está sin red muestra la pantalla de sin conexión.
   */
  if (hasNoBusiness && businessError) {
    return (
      <Screen padded>
        <View style={[styles.emptyHost, { paddingTop: insets.top }]}>
          <ErrorState error={businessError} onRetry={() => void refreshBusinesses()} />
        </View>
      </Screen>
    );
  }

  /* ── Sin negocios: el usuario acaba de registrarse ─────────────────────── */

  if (hasNoBusiness) {
    return (
      <Screen padded>
        <View style={[styles.emptyHost, { paddingTop: insets.top }]}>
          {/*
            La acción secundaria existe porque no todo el que se registra tiene
            tienda: hay quien entra solo a mirar lo que le fían. Sin ella
            quedaba encerrado en "crea tu primer negocio", sin forma de llegar
            al modo cliente.
          */}
          <EmptyState
            icon="storefront-outline"
            title="Crea tu primer negocio"
            message="Fiao organiza tus vales por negocio. Crea uno para empezar a registrar clientes y deudas."
            actionLabel="Crear negocio"
            onAction={() => router.push(routes.business.create)}
            secondaryActionLabel="No tengo tienda, me fían a mí"
            onSecondaryAction={() => {
              setMode('client');
              router.replace(routes.clientMode.wallet);
            }}
            tone="brand"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={debtors.isRefreshing}
          onRefresh={debtors.refresh}
          tintColor={theme.color.brand}
          colors={[theme.color.brand]}
        />
      }
      contentStyle={styles.scrollContent}
      statusBar="light"
    >
      {/* ── Héroe con el total por cobrar ───────────────────────────────── */}
      <LinearGradient
        colors={theme.gradient.hero}
        style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}
      >
        <View style={styles.heroHeader}>
          <Image
            source={require('../../../../assets/images/icon-blanco.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />

          {/*
            Los dos controles de "chrome" van juntos a la derecha de la barra:
            el de modo y el del perfil. Colgado del saludo, el de modo quedaba
            justo debajo del avatar y amontonaba esa esquina.
          */}
          <View style={styles.heroHeaderActions}>
            {/* Cambiar a modo cliente: ver lo que DEBE en otras tiendas. */}
            <ModeSwitcher inverse />

            <PressableScale
              onPress={() => router.push(routes.tabs.profile)}
              haptic="tap"
              activeScale={0.92}
              accessibilityLabel="Ir a tu perfil"
              style={styles.avatarButton}
            >
              <Ionicons name="person" size={20} color={theme.color.textInverse} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.heroContext}>
          <Text variant="caption" color="textInverseSubtle">
            {greeting}
          </Text>
          <BusinessSwitcher inverse />
        </View>

        <View style={styles.heroBalance}>
          <Text variant="caption" color="textInverseMuted">
            Total por cobrar
          </Text>

          {debtors.isLoading ? (
            <Skeleton width={220} height={44} radius={12} style={styles.heroSkeleton} />
          ) : (
            <AnimatedMoney value={summary.total} color="textInverse" />
          )}

          <Text variant="caption" color="textInverseSubtle">
            {activeBusiness ? `en ${activeBusiness.name}` : 'en tu negocio'}
          </Text>
        </View>

        <View style={styles.heroStats}>
          <HeroStat
            icon="alert-circle-outline"
            value={String(summary.withDebtCount)}
            label={summary.withDebtCount === 1 ? 'cliente debe' : 'clientes deben'}
            tone="warning"
          />
          <View style={styles.heroStatDivider} />
          <HeroStat
            icon="checkmark-circle-outline"
            value={String(summary.clearCount)}
            label={summary.clearCount === 1 ? 'cliente al día' : 'clientes al día'}
            tone="brand"
          />
        </View>
      </LinearGradient>

      {/* ── Accesos rápidos ─────────────────────────────────────────────── */}
      <View style={styles.body}>
        <StaleNotice visible={debtors.isStale} />

        <View style={styles.quickActions}>
          <QuickAction
            icon="person-add-outline"
            label="Nuevo cliente"
            onPress={() =>
              activeBusinessId && router.push(routes.client.create(activeBusinessId))
            }
            disabled={!activeBusinessId}
          />
          <QuickAction
            icon="people-outline"
            label="Ver clientes"
            onPress={() => router.push(routes.tabs.clients)}
          />
          <QuickAction
            icon="storefront-outline"
            label="Mis negocios"
            onPress={() => router.push(routes.tabs.businesses)}
          />
        </View>

        {/* ── Clientes que más deben ────────────────────────────────────── */}
        <SectionHeader
          title="Te deben"
          meta={
            summary.withDebtCount > 0
              ? pluralize(summary.withDebtCount, 'cliente')
              : undefined
          }
          actionLabel={summary.withDebtCount > TOP_DEBTORS ? 'Ver todos' : undefined}
          onAction={() => router.push(routes.tabs.clients)}
        />

        {debtors.isLoading ? (
          <View style={styles.list}>
            <CardSkeleton height={70} />
            <CardSkeleton height={70} />
            <CardSkeleton height={70} />
          </View>
        ) : debtors.error ? (
          <ErrorState error={debtors.error} onRetry={debtors.reload} />
        ) : summary.isEmpty ? (
          <EmptyState
            icon="person-add-outline"
            title="Aún no tienes clientes"
            message="Registra a la primera persona a la que le fías y empieza a llevar la cuenta."
            actionLabel="Agregar cliente"
            onAction={() =>
              activeBusinessId && router.push(routes.client.create(activeBusinessId))
            }
            tone="brand"
          />
        ) : summary.withDebtCount === 0 ? (
          <EmptyState
            icon="happy-outline"
            title="¡Todo cobrado!"
            message="Ninguno de tus clientes tiene saldo pendiente. Buen trabajo."
            tone="brand"
          />
        ) : (
          <View style={styles.list}>
            {summary.topDebtors.map((debtor) => (
              <DebtorRow
                key={debtor.id}
                debtor={debtor}
                onPress={() =>
                  router.push(
                    routes.client.detail(debtor.id, debtor.businessId ?? activeBusinessId ?? ''),
                  )
                }
              />
            ))}

            {summary.withDebtCount > TOP_DEBTORS ? (
              <Button
                label={`Ver los ${summary.withDebtCount} clientes`}
                variant="secondary"
                onPress={() => router.push(routes.tabs.clients)}
                iconRight="arrow-forward"
                fullWidth
              />
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
};

/* ── Piezas locales ───────────────────────────────────────────────────────── */

interface HeroStatProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tone: 'warning' | 'brand';
}

const HeroStat = ({ icon, value, label, tone }: HeroStatProps) => (
  <View style={styles.heroStat}>
    <Ionicons
      name={icon}
      size={16}
      color={tone === 'warning' ? theme.palette.warning[500] : theme.palette.brand[300]}
    />
    <Text variant="bodyStrong" color="textInverse">
      {value}
    </Text>
    <Text variant="caption" color="textInverseSubtle" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const QuickAction = ({ icon, label, onPress, disabled }: QuickActionProps) => (
  <PressableScale
    onPress={onPress}
    disabled={disabled}
    haptic="tap"
    activeScale={0.96}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.quickAction, disabled ? styles.quickActionDisabled : null]}
  >
    <IconBubble icon={icon} tone="brand" size={40} />
    <Text variant="captionStrong" align="center" numberOfLines={2}>
      {label}
    </Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: theme.spacing['3xl'],
  },
  hero: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing['2xl'],
    borderBottomLeftRadius: theme.radius['3xl'],
    borderBottomRightRadius: theme.radius['3xl'],
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 76,
    height: 30,
  },
  heroContext: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  heroHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBalance: {
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  heroSkeleton: {
    marginVertical: theme.spacing.xs,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    backgroundColor: theme.color.borderInverse,
  },
  body: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.xl,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.color.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    minHeight: 118,
    justifyContent: 'center',
  },
  quickActionDisabled: {
    opacity: 0.5,
  },
  list: {
    gap: theme.spacing.sm,
  },
  emptyHost: {
    flex: 1,
    justifyContent: 'center',
  },
});
