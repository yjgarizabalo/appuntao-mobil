/**
 * Inicio del modo cliente: cuánto debo y en qué tiendas.
 *
 * Es el espejo de `HomeScreen`. Allí el tendero ve "total por cobrar" y quién
 * le debe; aquí el cliente ve "debes en total" y a quién le debe. Se conserva
 * a propósito la misma estructura —héroe oscuro con la cifra grande, dos
 * contadores de apoyo y la lista debajo— para que cambiar de modo no se sienta
 * como entrar a otra aplicación.
 *
 * Los colores sí invierten su significado: en modo tendero el saldo pendiente
 * es plata que va a entrar y se pinta de marca; aquí es plata que debe salir,
 * y se pinta de rojo.
 *
 * El total se calcula sumando las deudas de cada tienda (ver `clientApi`),
 * porque el backend todavía no expone un consolidado del lado del cliente.
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
import { formatRelativeDate, getFirstName, pluralize } from '@/core/utils/format';
import { type ClientStanding, displayName, summarizeStandings } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { clientApi } from '@/features/client/api/clientApi';
import { ClientNotLinked } from '@/features/client/components/ClientNotLinked';
import { ClientStoreCard } from '@/features/client/components/ClientStoreCard';
import { ModeSwitcher } from '@/features/client/components/ModeSwitcher';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import {
  AnimatedMoney,
  Button,
  Card,
  CardSkeleton,
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

export const ClientWalletScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { refreshAccounts } = useAppMode();

  const standings = useAsyncData<ClientStanding[]>(() => clientApi.loadOverview(), {
    // Por usuario: las tiendas donde a alguien le fían son suyas y no deben
    // sobrevivir al cambio de cuenta en el mismo teléfono.
    cacheKey: user?.id ? `client-overview:${user.id}` : undefined,
  });

  // Al volver de aceptar una invitación o de ver una tienda, la cifra debe
  // estar al día; de paso se refresca el vínculo que alimenta el interruptor.
  useFocusEffect(
    useCallback(() => {
      void standings.refresh();
      void refreshAccounts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const rows = useMemo(() => standings.data ?? [], [standings.data]);
  const overview = useMemo(() => summarizeStandings(rows), [rows]);

  const greeting = `Hola, ${getFirstName(displayName(user)) || 'Usuario'}`;
  const storesClear = Math.max(0, overview.storesTotal - overview.storesWithDebt);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={standings.isRefreshing}
          onRefresh={standings.refresh}
          tintColor={theme.color.brand}
          colors={[theme.color.brand]}
        />
      }
      contentStyle={styles.scrollContent}
      statusBar="light"
    >
      {/* ── Héroe con lo que debe en total ──────────────────────────────── */}
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

          {/* Misma barra que `HomeScreen`: modo y perfil juntos a la derecha. */}
          <View style={styles.heroHeaderActions}>
            {/* Volver a modo tendero. */}
            <ModeSwitcher inverse />

            <PressableScale
              onPress={() => router.push(routes.clientMode.profile)}
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
        </View>

        <View style={styles.heroBalance}>
          <Text variant="caption" color="textInverseMuted">
            Debes en total
          </Text>

          {standings.isLoading ? (
            <Skeleton width={220} height={44} radius={12} style={styles.heroSkeleton} />
          ) : (
            <AnimatedMoney value={overview.totalBalance} color="textInverse" />
          )}

          <Text variant="caption" color="textInverseSubtle">
            {overview.storesTotal === 1 ? 'en 1 tienda' : `en ${overview.storesTotal} tiendas`}
          </Text>
        </View>

        {overview.storesTotal > 0 ? (
          <View style={styles.heroStats}>
            <HeroStat
              icon="alert-circle-outline"
              value={String(overview.storesWithDebt)}
              label={overview.storesWithDebt === 1 ? 'tienda con saldo' : 'tiendas con saldo'}
              tone="warning"
            />
            <View style={styles.heroStatDivider} />
            <HeroStat
              icon="checkmark-circle-outline"
              value={String(storesClear)}
              label={storesClear === 1 ? 'tienda al día' : 'tiendas al día'}
              tone="brand"
            />
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.body}>
        <StaleNotice visible={standings.isStale} />

        {/* ── Estados de la lista ───────────────────────────────────────── */}
        {standings.isLoading ? (
          <View style={styles.list}>
            <CardSkeleton height={70} />
            <CardSkeleton height={70} />
          </View>
        ) : standings.error ? (
          <ErrorState error={standings.error} onRetry={standings.reload} />
        ) : rows.length === 0 ? (
          <ClientNotLinked />
        ) : (
          <>
            {/* La cifra puede estar incompleta: hay que decirlo, no esconderlo. */}
            {overview.hasFailures ? (
              <NoticeCard
                icon="cloud-offline-outline"
                title="Falta una tienda por cargar"
                message="Desliza hacia abajo para reintentar. Mientras tanto el total puede estar incompleto."
              />
            ) : null}

            {overview.oldestOverdueDate ? (
              <NoticeCard
                icon="time-outline"
                title="Tienes un vale vencido"
                message={`El más antiguo venció ${formatRelativeDate(overview.oldestOverdueDate)}. Escríbele a la tienda para ponerte al día.`}
              />
            ) : null}

            <SectionHeader title="Tus tiendas" meta={pluralize(overview.storesTotal, 'tienda')} />

            <View style={styles.list}>
              {rows.map((standing) => (
                <ClientStoreCard
                  key={`${standing.account.businessId}-${standing.account.debtorId}`}
                  standing={standing}
                  onPress={() =>
                    router.push(
                      routes.clientMode.store(
                        standing.account.debtorId,
                        standing.account.businessId,
                      ),
                    )
                  }
                />
              ))}
            </View>

            <Button
              label="Ver todos los movimientos"
              variant="secondary"
              iconRight="arrow-forward"
              onPress={() => router.push(routes.clientMode.movements)}
              fullWidth
              style={styles.movementsButton}
            />

            {overview.totalBalance === 0 ? (
              <Text variant="caption" color="textSubtle" align="center" style={styles.clearNote}>
                No debes nada en ninguna tienda. ¡Así se mantiene el fiado!
              </Text>
            ) : null}
          </>
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

interface NoticeCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

/** Aviso informativo: no exige decidir nada, por eso no es un `Dialog`. */
const NoticeCard = ({ icon, title, message }: NoticeCardProps) => (
  <Card padding="md" style={styles.notice}>
    <View style={styles.noticeRow}>
      <IconBubble icon={icon} tone="warning" size={38} />
      <View style={styles.noticeBody}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textMuted">
          {message}
        </Text>
      </View>
    </View>
  </Card>
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
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
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
  notice: {
    marginBottom: theme.spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  noticeBody: {
    flex: 1,
    gap: 2,
  },
  list: {
    gap: theme.spacing.sm,
  },
  movementsButton: {
    marginTop: theme.spacing.xl,
  },
  clearNote: {
    marginTop: theme.spacing.lg,
  },
});
