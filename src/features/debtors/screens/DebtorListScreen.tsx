/**
 * Lista de clientes.
 *
 * Mejoras sobre el v1:
 *  - `FlatList` en vez de `ScrollView` con `.map()`: recicla filas, así que
 *    500 clientes se desplazan igual de fluido que 10;
 *  - scroll infinito en lugar de botones de página;
 *  - filtros por estado (todos / deben / al día) resueltos en el servidor,
 *    con contadores exactos del negocio y no de la página cargada;
 *  - buscador con debounce de 500ms; si el negocio tiene 20 clientes o menos
 *    (una sola página) filtra **en el dispositivo** sobre lo ya cargado, y
 *    solo consulta al **servidor** de 21 en adelante, cuando el cliente
 *    buscado puede estar en una página que el móvil no descargó;
 *  - pull-to-refresh;
 *  - estados de carga, vacío, "sin resultados" y error, cada uno con su texto.
 *
 * Sirve para dos casos: los clientes del negocio activo (por defecto) o los de
 * un negocio concreto cuando llega `businessId` por parámetro.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';
import { usePagedList } from '@/core/hooks/usePagedList';
import { routes } from '@/core/navigation/routes';
import { formatMoney, normalizeText, pluralize } from '@/core/utils/format';
import { type Debtor, debtorBalance } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import { DebtorRow } from '@/features/debtors/components/DebtorRow';
import { WhatsAppBulkSheet } from '@/features/debtors/components/WhatsAppBulkSheet';
import {
  AppBar,
  Button,
  EmptyState,
  ErrorState,
  Fab,
  ListFooterLoader,
  ListSkeleton,
  PressableScale,
  Screen,
  SearchBar,
  SegmentedControl,
  StaleNotice,
  Text,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

type StatusFilter = 'all' | 'debt' | 'clear';
/** Alcance de la lista: solo el negocio activo o todos los negocios. */
type Scope = 'business' | 'all';

const PAGE_SIZE = 20;

/**
 * Con este total de clientes o menos, `list.items` ya trae a todo el mundo
 * (caben en una sola página): buscar es filtrar en el dispositivo y no gasta
 * el servicio. De 21 en adelante hay que seguir preguntándole al servidor,
 * porque el cliente buscado puede estar en una página que el móvil nunca
 * descargó.
 */
const SEARCH_LOCAL_MAX = PAGE_SIZE;

export const DebtorListScreen = () => {
  const params = useLocalSearchParams<{ businessId?: string }>();
  const { user } = useSession();
  const {
    activeBusinessId,
    businesses,
    getBusiness,
    isEmpty: hasNoBusiness,
    can,
    error: businessError,
    refresh: refreshBusinesses,
  } =
    useBusinesses();

  /** El parámetro manda; si no viene, se usa el negocio activo. */
  const businessId = params.businessId ?? activeBusinessId ?? null;
  const business = businessId ? getBusiness(businessId) : undefined;
  const isFilteredByParam = Boolean(params.businessId);

  // Un VIEWER no registra clientes: se oculta el FAB y la acción del vacío.
  const canCreateDebtor = businessId ? can('debtor:create', businessId) : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scope, setScope] = useState<Scope>('business');
  const debouncedSearch = useDebouncedValue(search, 500);
  const toast = useToast();

  /**
   * Selección múltiple para el envío de recordatorios por WhatsApp. Se guarda
   * el `Debtor` completo (no solo el id): la búsqueda y el filtro recargan
   * `list.items` desde el servidor, así que un cliente seleccionado antes de
   * teclear en el buscador debe seguir disponible aunque ya no esté en la
   * página cargada.
   */
  const [isSelecting, setIsSelecting] = useState(false);
  const [selected, setSelected] = useState<Map<string, Debtor>>(new Map());
  const [isSendSheetOpen, setIsSendSheetOpen] = useState(false);

  /**
   * El conmutador de alcance solo tiene sentido con más de un negocio y
   * cuando no se llegó filtrando por uno concreto.
   */
  const canSwitchScope = businesses.length > 1 && !isFilteredByParam;
  const effectiveScope: Scope = canSwitchScope ? scope : 'business';

  const hasDebtFilter = statusFilter === 'all' ? undefined : statusFilter === 'debt';

  /**
   * Totales exactos del negocio para los contadores de los chips (y, más
   * abajo, para decidir si buscar es cosa del servidor o del dispositivo). Es
   * una petición agregada y barata; contarlos sobre `list.items` decía "20
   * clientes" cuando había 300. No aplica al alcance "todos los negocios",
   * que no tiene un resumen equivalente en el backend: ahí los chips van sin
   * número, y la búsqueda sigue yendo siempre al servidor (ver
   * `canSearchLocally`).
   */
  const totals = useAsyncData(
    () => debtorApi.getSummary(businessId as string, 0),
    {
      enabled: effectiveScope === 'business' && Boolean(businessId),
      deps: [businessId, effectiveScope],
      cacheKey:
        user?.id && businessId ? `debtor-summary:${user.id}:${businessId}` : undefined,
    },
  );

  const counts = useMemo(() => {
    const data = totals.data;
    if (!data) return { all: undefined, debt: undefined, clear: undefined };
    return { all: data.totalDebtors, debt: data.debtorsWithDebt, clear: data.debtorsClear };
  }, [totals.data]);

  /**
   * Con `SEARCH_LOCAL_MAX` clientes o menos en este filtro, `list.items` ya
   * los trae a todos: se busca filtrando en el dispositivo y no se le pide
   * nada al servidor mientras se teclea. Con más, la búsqueda sigue yendo al
   * servidor como antes, porque el cliente buscado puede estar en una página
   * que el móvil no descargó. El conteo exacto solo existe para "este
   * negocio" (`totals`); "todos mis negocios" no tiene un total barato y por
   * eso siempre busca en el servidor.
   */
  const knownTotal = effectiveScope === 'business' ? counts[statusFilter] : undefined;
  const canSearchLocally = knownTotal !== undefined && knownTotal <= SEARCH_LOCAL_MAX;
  const serverSearchTerm = canSearchLocally ? undefined : debouncedSearch;

  /**
   * Solo se cachea la vista por defecto (sin búsqueda ni filtro): es la que se
   * ve al abrir la pestaña y la que debe aparecer al instante aunque el backend
   * esté dormido. Los resultados de una búsqueda o de un filtro concreto cambian
   * demasiado como para persistirlos, y además siempre consultan al servidor.
   */
  const isDefaultView = debouncedSearch.trim().length === 0 && statusFilter === 'all';
  const listCacheKey =
    isDefaultView && user?.id
      ? effectiveScope === 'all'
        ? `debtors:${user.id}:all`
        : businessId
          ? `debtors:${user.id}:${businessId}`
          : undefined
      : undefined;

  const list = usePagedList<Debtor>(
    (page, limit) => {
      const query = { search: serverSearchTerm, hasDebt: hasDebtFilter };
      return effectiveScope === 'all'
        ? debtorApi.listAll(page, limit, query)
        : debtorApi.listByBusiness(businessId as string, page, limit, query);
    },
    {
      pageSize: PAGE_SIZE,
      enabled: effectiveScope === 'all' || Boolean(businessId),
      deps: [businessId, effectiveScope, serverSearchTerm, hasDebtFilter],
      cacheKey: listCacheKey,
    },
  );

  // Al volver del detalle, los saldos pueden haber cambiado.
  useFocusEffect(
    useCallback(() => {
      if (effectiveScope === 'all' || businessId) {
        void list.refresh();
        void totals.refresh();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId, effectiveScope]),
  );

  /**
   * En modo local, `list.items` trae a todo el mundo sin filtrar: se aplica
   * aquí el mismo criterio del backend (minúsculas, sin tildes) sobre nombre,
   * documento y teléfono.
   */
  const visibleDebtors = useMemo(() => {
    if (!canSearchLocally) return list.items;
    const query = normalizeText(debouncedSearch.trim());
    if (!query) return list.items;
    return list.items.filter((debtor) =>
      normalizeText(`${debtor.name} ${debtor.documentNumber} ${debtor.phone}`).includes(query),
    );
  }, [canSearchLocally, list.items, debouncedSearch]);

  /**
   * Saldo total del negocio, tal como lo calcula el servidor. Sumar
   * `list.items` daba la suma de la página cargada presentada como si fuera
   * el total del negocio.
   */
  const totalOwed = statusFilter === 'clear' ? 0 : (totals.data?.totalBalance ?? 0);

  const openDebtor = useCallback(
    (debtor: Debtor) => {
      const targetBusinessId = debtor.businessId ?? businessId;
      if (!targetBusinessId) return;
      router.push(routes.client.detail(debtor.id, targetBusinessId));
    },
    [businessId],
  );

  /* ── Selección múltiple y envío por WhatsApp ─────────────────────────────
   * "Masivo" es abrir WhatsApp uno por uno con el mensaje ya escrito (ver
   * `WhatsAppBulkSheet`); esto solo arma la lista de a quién.
   */

  // Cambiar de negocio o de alcance es cambiar el universo de clientes: una
  // selección hecha en el otro contexto ya no tiene sentido.
  useEffect(() => {
    setSelected(new Map());
  }, [businessId, effectiveScope]);

  const toggleSelectionMode = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
      setSelected(new Map());
      return;
    }
    haptics.tap();
    setIsSelecting(true);
    // Solo tiene sentido recordarle a quien debe: se arranca ya filtrado ahí.
    setStatusFilter('debt');
  }, [isSelecting]);

  const toggleSelected = useCallback((debtor: Debtor) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(debtor.id)) next.delete(debtor.id);
      else next.set(debtor.id, debtor);
      return next;
    });
  }, []);

  const selectAllEligible = useCallback(() => {
    haptics.select();
    setSelected((current) => {
      const next = new Map(current);
      for (const debtor of list.items) {
        if (debtor.phone.length > 0 && debtorBalance(debtor) > 0) next.set(debtor.id, debtor);
      }
      return next;
    });
  }, [list.items]);

  const resolveBusinessName = useCallback(
    (debtor: Debtor) => (debtor.businessId ? getBusiness(debtor.businessId)?.name : undefined),
    [getBusiness],
  );

  const handleSendSheetClose = useCallback(
    (sentCount: number) => {
      setIsSendSheetOpen(false);
      if (sentCount === 0) return;
      // Solo se limpia la selección si de verdad se mandó algo: si el
      // tendero cerró sin enviar nada, prefiere seguir donde iba.
      toast.success(pluralize(sentCount, 'recordatorio enviado', 'recordatorios enviados'));
      setIsSelecting(false);
      setSelected(new Map());
    },
    [toast],
  );

  const selectedDebtors = useMemo(() => Array.from(selected.values()), [selected]);

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
      <Screen>
        <AppBar title="Clientes" large />
        <ErrorState error={businessError} onRetry={() => void refreshBusinesses()} />
      </Screen>
    );
  }

  /* ── Sin negocio todavía ───────────────────────────────────────────────── */

  if (hasNoBusiness || (!businessId && effectiveScope !== 'all')) {
    return (
      <Screen>
        <AppBar title="Clientes" large />
        <EmptyState
          icon="storefront-outline"
          title="Primero crea un negocio"
          message="Los clientes se registran dentro de un negocio. Crea el tuyo para empezar."
          actionLabel="Crear negocio"
          onAction={() => router.push(routes.business.create)}
          tone="brand"
        />
      </Screen>
    );
  }

  const isSearching = debouncedSearch.trim().length > 0 || statusFilter !== 'all';

  return (
    <Screen
      footer={
        isSelecting ? (
          <Button
            label={
              selectedDebtors.length > 0
                ? `Enviar a ${selectedDebtors.length}`
                : 'Elige a quién recordarle'
            }
            icon="logo-whatsapp"
            onPress={() => setIsSendSheetOpen(true)}
            disabled={selectedDebtors.length === 0}
            size="lg"
            fullWidth
          />
        ) : undefined
      }
    >
      <AppBar
        title={isFilteredByParam ? (business?.name ?? 'Clientes') : 'Clientes'}
        subtitle={isFilteredByParam ? 'Clientes de este negocio' : undefined}
        onBack={isFilteredByParam ? () => router.back() : undefined}
        large={!isFilteredByParam}
        actionIcon={isSelecting ? 'close' : 'checkbox-outline'}
        actionLabel={isSelecting ? 'Cancelar selección' : 'Seleccionar clientes'}
        onAction={toggleSelectionMode}
      />

      <View style={styles.controls}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, documento o teléfono"
        />

        {canSwitchScope ? (
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: 'business', label: business?.name ?? 'Este negocio' },
              { value: 'all', label: 'Todos mis negocios' },
            ]}
          />
        ) : null}

        <SegmentedControl<StatusFilter>
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Todos', count: counts.all },
            { value: 'debt', label: 'Deben', count: counts.debt },
            { value: 'clear', label: 'Al día', count: counts.clear },
          ]}
        />

        {isSelecting ? (
          <View style={styles.totalRow}>
            <Text variant="caption" color="textMuted">
              {selectedDebtors.length > 0
                ? pluralize(
                    selectedDebtors.length,
                    'cliente seleccionado',
                    'clientes seleccionados',
                  )
                : 'Toca a quien le quieras recordar'}
            </Text>
            <PressableScale
              onPress={selectAllEligible}
              haptic="select"
              accessibilityRole="button"
              accessibilityLabel="Seleccionar a todos los que deben"
            >
              <Text variant="captionStrong" color="brandStrong">
                Seleccionar todos
              </Text>
            </PressableScale>
          </View>
        ) : totalOwed > 0 ? (
          <View style={styles.totalRow}>
            <Text variant="caption" color="textMuted">
              Total por cobrar
            </Text>
            <Text variant="captionStrong" color="dangerStrong">
              {formatMoney(totalOwed)}
            </Text>
          </View>
        ) : null}
      </View>

      <StaleNotice visible={list.isStale || totals.isStale} />

      {/*
        El skeleton solo aparece cuando no hay nada que enseñar. Como la
        búsqueda ahora va al servidor, cada tecleo recarga la lista; si el
        skeleton saliera siempre, la pantalla parpadearía en cada letra. Se
        mantienen los resultados anteriores hasta que llegan los nuevos.
      */}
      {list.isLoading && list.items.length === 0 ? (
        <View style={styles.skeletonHost}>
          <ListSkeleton />
        </View>
      ) : list.error && list.items.length === 0 ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={visibleDebtors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DebtorRow
              debtor={item}
              onPress={() => (isSelecting ? toggleSelected(item) : openDebtor(item))}
              selectable={isSelecting}
              selected={selected.has(item.id)}
              businessName={
                effectiveScope === 'all' && item.businessId
                  ? getBusiness(item.businessId)?.name
                  : undefined
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          // Recicla agresivamente: la app corre en celulares de gama baja.
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefreshing}
              onRefresh={list.refresh}
              tintColor={theme.color.brand}
              colors={[theme.color.brand]}
            />
          }
          ListFooterComponent={<ListFooterLoader visible={list.isLoadingMore} />}
          ListEmptyComponent={
            isSearching ? (
              <EmptyState
                icon="search-outline"
                title="Sin resultados"
                message={
                  debouncedSearch.trim().length > 0
                    ? `No encontramos clientes que coincidan con "${debouncedSearch.trim()}".`
                    : 'Ningún cliente cumple con este filtro.'
                }
                secondaryActionLabel="Limpiar filtros"
                onSecondaryAction={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              />
            ) : (
              <EmptyState
                icon="person-add-outline"
                title="Aún no hay clientes"
                message="Registra a la primera persona a la que le fías y lleva su cuenta al día."
                actionLabel={businessId && canCreateDebtor ? 'Agregar cliente' : undefined}
                onAction={
                  businessId && canCreateDebtor
                    ? () => router.push(routes.client.create(businessId))
                    : undefined
                }
                tone="brand"
              />
            )
          }
        />
      )}

      {businessId && !isSelecting && canCreateDebtor ? (
        <Fab label="Agregar" onPress={() => router.push(routes.client.create(businessId))} />
      ) : null}

      <WhatsAppBulkSheet
        visible={isSendSheetOpen}
        debtors={selectedDebtors}
        getBusinessName={resolveBusinessName}
        onClose={handleSendSheetClose}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  controls: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
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
});
