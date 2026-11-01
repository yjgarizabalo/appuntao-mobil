/**
 * Extracto del cliente: todo lo que le fiaron y todo lo que abonó, en todas
 * las tiendas a la vez y ordenado por fecha.
 *
 * Es lo que el modo tendero no tiene equivalente directo: allá el extracto es
 * de un cliente dentro de un negocio, mientras que aquí la pregunta es "¿en
 * qué se me fue el fiado este mes?" sin importar la tienda. Por eso cada fila
 * dice de dónde viene.
 *
 * La estructura copia la de `DebtorListScreen`, que es la pantalla-lista de
 * referencia del proyecto: `Screen` con el fondo de la app, `AppBar large`, los
 * controles fijos debajo —no se van con el scroll— y la lista al final. El
 * fondo se deja en el de siempre a propósito: con `background="surface"` la
 * pantalla se pintaba blanca de borde a borde y, como la barra de estado es
 * translúcida, esa pestaña mostraba ahí un color distinto al del resto de la
 * app. Las filas se ven sobre superficie gracias al contenedor de la lista.
 *
 * El filtro se aplica en memoria: el extracto ya está cargado entero (sale de
 * las mismas deudas que alimentan el inicio), así que filtrar no cuesta una
 * petición.
 *
 * Comparte `cacheKey` con el inicio del modo cliente a propósito: las dos
 * pantallas se arman con la misma respuesta, y así al entrar aquí se ve el
 * extracto al instante en vez de esperar de nuevo al servidor.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useAsyncData } from '@/core/hooks/useAsyncData';
import { formatMoney } from '@/core/utils/format';
import {
  type ClientMovement,
  type ClientStanding,
  buildClientMovements,
} from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { clientApi } from '@/features/client/api/clientApi';
import { ClientMovementRow } from '@/features/client/components/ClientMovementRow';
import {
  AppBar,
  Divider,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Screen,
  SegmentedControl,
  StaleNotice,
  Text,
} from '@/ui';
import { theme } from '@/theme';

type MovementFilter = 'all' | 'debts' | 'payments';

export const ClientMovementsScreen = () => {
  const { user } = useSession();
  const [filter, setFilter] = useState<MovementFilter>('all');

  const standings = useAsyncData<ClientStanding[]>(() => clientApi.loadOverview(), {
    cacheKey: user?.id ? `client-overview:${user.id}` : undefined,
  });

  useFocusEffect(
    useCallback(() => {
      void standings.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const movements = useMemo(
    () => buildClientMovements(standings.data ?? []),
    [standings.data],
  );

  const counts = useMemo(() => {
    let debts = 0;
    let payments = 0;
    for (const row of movements) {
      if (row.movement.kind === 'debt') debts += 1;
      else payments += 1;
    }
    return { all: movements.length, debts, payments };
  }, [movements]);

  const visible = useMemo(() => {
    if (filter === 'all') return movements;
    const kind = filter === 'debts' ? 'debt' : 'payment';
    return movements.filter((row) => row.movement.kind === kind);
  }, [filter, movements]);

  /** Lo fiado y lo abonado en total, para el resumen de arriba. */
  const totals = useMemo(() => {
    let owed = 0;
    let paid = 0;
    for (const row of movements) {
      if (row.movement.kind === 'debt') owed += row.movement.amount;
      else if (row.movement.payment.type === 'PAYMENT') paid += row.movement.amount;
    }
    return { owed, paid };
  }, [movements]);

  const renderItem = useCallback(
    ({ item }: { item: ClientMovement }) => <ClientMovementRow row={item} />,
    [],
  );

  return (
    <Screen>
      <AppBar title="Movimientos" large />

      {standings.isLoading ? (
        <View style={styles.padded}>
          <ListSkeleton count={8} />
        </View>
      ) : standings.error ? (
        <ErrorState error={standings.error} onRetry={standings.reload} />
      ) : movements.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Todavía no hay movimientos"
          message="Cuando una tienda te fíe algo o registre un abono tuyo, aparecerá aquí."
          tone="brand"
        />
      ) : (
        <>
          {/* Controles fijos: el filtro no debe irse con el scroll. */}
          <View style={styles.controls}>
            <StaleNotice visible={standings.isStale} />

            <Text variant="caption" color="textMuted" style={styles.summary}>
              Te han fiado{' '}
              <Text variant="captionStrong" color="dangerStrong">
                {formatMoney(totals.owed)}
              </Text>
              {'   ·   '}
              Has abonado{' '}
              <Text variant="captionStrong" color="brandStrong">
                {formatMoney(totals.paid)}
              </Text>
            </Text>

            <SegmentedControl<MovementFilter>
              options={[
                { value: 'all', label: 'Todos', count: counts.all },
                { value: 'debts', label: 'Fiado', count: counts.debts },
                { value: 'payments', label: 'Abonos', count: counts.payments },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </View>

          <FlatList
            data={visible}
            keyExtractor={(row) => row.movement.id}
            renderItem={renderItem}
            ItemSeparatorComponent={Divider}
            /*
             * El contenedor de la lista es el que lleva la superficie: así las
             * filas se leen como un extracto de una sola pieza sin convertir
             * cada movimiento en una tarjeta suelta, y el fondo de la pantalla
             * —y con él la franja de la barra de estado— sigue siendo el de
             * toda la app.
             */
            contentContainerStyle={styles.listContent}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={standings.isRefreshing}
                onRefresh={standings.refresh}
                tintColor={theme.color.brand}
                colors={[theme.color.brand]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="filter-outline"
                title="Nada en este filtro"
                message={
                  filter === 'debts'
                    ? 'No hay vales fiados registrados.'
                    : 'Todavía no tienes abonos registrados.'
                }
                secondaryActionLabel="Ver todos"
                onSecondaryAction={() => setFilter('all')}
              />
            }
          />
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.lg,
  },
  controls: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  summary: {
    paddingTop: theme.spacing.xxs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    marginHorizontal: theme.layout.gutter,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.color.border,
  },
});
