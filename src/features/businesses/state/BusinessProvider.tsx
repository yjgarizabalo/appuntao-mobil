/**
 * Negocios del usuario y negocio activo.
 *
 * Es el único estado de dominio que sí merece ser global: casi todas las
 * peticiones necesitan un `businessId`, y el usuario espera que la app
 * recuerde con qué negocio estaba trabajando entre sesiones (se persiste en
 * AsyncStorage).
 *
 * El v1 tenía cinco providers anidados; clientes, deudas y pagos no
 * necesitaban estado compartido —cada pantalla carga sus propios datos— así
 * que aquí quedan solo dos: sesión y negocios.
 *
 * **La lista se mantiene al día sola.** El rol del usuario sale de aquí, y
 * otra persona puede cambiarlo mientras la app está abierta: sacarlo del
 * equipo, cambiarle el rol, pasarle un negocio o aceptar el que él propuso.
 * Por eso se vuelve a pedir, en silencio y sin spinner:
 *  - cuando la app vuelve del fondo;
 *  - al entrar a las pantallas que muestran el rol (`useRefreshBusinessesOnFocus`);
 *  - cuando una operación sobre un negocio responde 403 (`onBusinessForbidden`).
 * `refreshIfStale` deja un mínimo de tiempo entre consultas y nunca lanza dos a
 * la vez.
 */
import { useFocusEffect } from 'expo-router';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { type AppError, toAppError } from '@/core/errors/AppError';
import { onBusinessForbidden } from '@/core/http/businessAccess';
import { createLogger } from '@/core/logger';
import { readCache, writeCache } from '@/core/storage/cache';
import { StorageKeys, getItem, setItem } from '@/core/storage/storage';
import type { BusinessRole } from '@/domain/constants';
import { type Business, type BusinessDraft, roleInBusiness } from '@/domain/models';
import { type BusinessAction, can as canDo } from '@/domain/permissions';
import { useSession } from '@/features/auth/session/SessionProvider';
import { businessApi } from '@/features/businesses/api/businessApi';

const log = createLogger('business');

/** Tiempo mínimo entre dos recargas automáticas de la lista. */
const AUTO_REFRESH_MIN_AGE_MS = 15_000;

interface BusinessContextValue {
  businesses: Business[];
  /** Negocio con el que se está trabajando. `null` si aún no hay ninguno. */
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  /**
   * Rol del usuario en el negocio activo. `null` cuando es desconocido (aún
   * cargando o el backend no incluyó los miembros); en ese caso `can()` es
   * permisivo y deja que el 403 del servidor decida.
   */
  activeRole: BusinessRole | null;
  /**
   * ¿Puede el usuario ejecutar esta acción? Sin `businessId` usa el negocio
   * activo; con `businessId` evalúa el rol en ese negocio concreto (la pantalla
   * de detalle o la lista filtrada por parámetro pueden operar sobre uno que no
   * es el activo).
   */
  can: (action: BusinessAction, businessId?: string) => boolean;
  isLoading: boolean;
  error: AppError | null;
  /** `true` cuando el usuario todavía no ha creado ningún negocio. */
  isEmpty: boolean;
  selectBusiness: (businessId: string) => void;
  /** Recarga con indicador (pull-to-refresh, botón de reintentar). */
  refresh: () => Promise<void>;
  /**
   * Recarga en silencio si la última carga tiene más de `minAgeMs` (por defecto
   * 15 s). Para mantener el rol al día sin que el usuario lo note.
   */
  refreshIfStale: (minAgeMs?: number) => Promise<void>;
  createBusiness: (draft: BusinessDraft) => Promise<Business>;
  getBusiness: (businessId: string) => Business | undefined;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useSession();
  const userId = user?.id ?? null;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  /**
   * Espejo síncrono de `businesses`: en el `catch` de `load` hay que saber si ya
   * hay negocios (de caché o de una carga previa) sin esperar a un re-render.
   */
  const businessesRef = useRef<Business[]>([]);
  const applyBusinesses = useCallback((items: Business[]) => {
    businessesRef.current = items;
    setBusinesses(items);
  }, []);

  /**
   * Restaura el negocio guardado; si ya no existe (lo borraron), cae al primero
   * disponible. Se ejecuta tanto al hidratar de caché como tras la red.
   */
  const resolveActiveBusiness = useCallback(async (items: Business[]) => {
    const storedId = await getItem(StorageKeys.activeBusinessId);
    const preferred = items.find((business) => business.id === storedId) ?? items[0] ?? null;
    setActiveBusinessId(preferred?.id ?? null);
    if (preferred && preferred.id !== storedId) {
      await setItem(StorageKeys.activeBusinessId, preferred.id);
    }
  }, []);

  /** Cuándo terminó la última carga desde la red, y si hay una en curso. */
  const lastLoadedAtRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoading(true);
    setError(null);

    const cacheKey = userId ? `businesses:${userId}` : undefined;

    // Rehidratación: pinta los negocios guardados para que la app NO muestre
    // "crea tu primer negocio" mientras el backend gratuito despierta. Sin esto,
    // un arranque en frío que vence dejaba `businesses=[]` y disparaba esa
    // pantalla por error.
    if (cacheKey && businessesRef.current.length === 0) {
      const hit = await readCache<Business[]>(cacheKey);
      if (hit && hit.data.length > 0) {
        applyBusinesses(hit.data);
        await resolveActiveBusiness(hit.data);
        setHasLoaded(true);
      }
    }

    try {
      const items = await businessApi.listAll();
      applyBusinesses(items);
      await resolveActiveBusiness(items);
      if (cacheKey) void writeCache(cacheKey, items);
      lastLoadedAtRef.current = Date.now();
    } catch (caught) {
      const appError = toAppError(caught);
      log.error('No se pudieron cargar los negocios', { code: appError.code });
      // Si ya hay negocios que mostrar (caché o carga previa), no se borran: el
      // servidor dormido no debe mandar al usuario a "crea tu primer negocio".
      if (businessesRef.current.length === 0) {
        setError(appError);
        applyBusinesses([]);
      }
    } finally {
      if (!silent) setIsLoading(false);
      setHasLoaded(true);
    }
  }, [applyBusinesses, resolveActiveBusiness, userId]);

  const refresh = useCallback(() => load(), [load]);

  const refreshIfStale = useCallback(
    async (minAgeMs = AUTO_REFRESH_MIN_AGE_MS) => {
      if (!isAuthenticated) return;
      if (inFlightRef.current) return inFlightRef.current;
      if (Date.now() - lastLoadedAtRef.current < minAgeMs) return;
      const run = load({ silent: true }).finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = run;
      return run;
    },
    [isAuthenticated, load],
  );

  // Al volver del fondo: pudo pasar cualquier cosa con el equipo mientras tanto.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  // Un 403 sobre un negocio: el acceso cambió. Se recarga casi de inmediato
  // (con un margen corto para no repetir si fallan varias peticiones a la vez).
  useEffect(() => onBusinessForbidden(() => void refreshIfStale(2_000)), [refreshIfStale]);

  // Se cargan al autenticarse y se limpian al salir.
  useEffect(() => {
    if (isAuthenticated) {
      void load();
    } else {
      applyBusinesses([]);
      setActiveBusinessId(null);
      setHasLoaded(false);
      setError(null);
    }
  }, [isAuthenticated, load, applyBusinesses]);

  const selectBusiness = useCallback((businessId: string) => {
    setActiveBusinessId(businessId);
    void setItem(StorageKeys.activeBusinessId, businessId);
  }, []);

  const createBusiness = useCallback(
    async (draft: BusinessDraft) => {
      const created = await businessApi.create(draft);
      const next = [...businessesRef.current, created];
      applyBusinesses(next);
      // Se refresca la caché para que el negocio recién creado sobreviva a un
      // reinicio aunque el backend se duerma antes de la siguiente carga.
      if (userId) void writeCache(`businesses:${userId}`, next);
      // El primer negocio pasa a ser el activo automáticamente: es lo que el
      // usuario espera justo después de crearlo.
      if (!activeBusinessId) selectBusiness(created.id);
      return created;
    },
    [activeBusinessId, applyBusinesses, selectBusiness, userId],
  );

  const getBusiness = useCallback(
    (businessId: string) => businesses.find((business) => business.id === businessId),
    [businesses],
  );

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId],
  );

  const activeRole = useMemo(
    () => roleInBusiness(activeBusiness, userId),
    [activeBusiness, userId],
  );

  const roleFor = useCallback(
    (businessId: string) =>
      roleInBusiness(
        businesses.find((business) => business.id === businessId),
        userId,
      ),
    [businesses, userId],
  );

  const can = useCallback(
    (action: BusinessAction, businessId?: string) =>
      canDo(businessId ? roleFor(businessId) : activeRole, action),
    [activeRole, roleFor],
  );

  const value = useMemo<BusinessContextValue>(
    () => ({
      businesses,
      activeBusiness,
      activeBusinessId,
      activeRole,
      can,
      isLoading,
      error,
      isEmpty: hasLoaded && businesses.length === 0,
      selectBusiness,
      refresh,
      refreshIfStale,
      createBusiness,
      getBusiness,
    }),
    [
      businesses,
      activeBusiness,
      activeBusinessId,
      activeRole,
      can,
      isLoading,
      error,
      hasLoaded,
      selectBusiness,
      refresh,
      refreshIfStale,
      createBusiness,
      getBusiness,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
};

/**
 * Vuelve a pedir los negocios (en silencio, si la última carga ya tiene un
 * rato) cada vez que la pantalla gana el foco. Va en las pantallas que
 * muestran el rol o dependen de él: Inicio, Mis negocios, Perfil y Equipo.
 */
export const useRefreshBusinessesOnFocus = (): void => {
  const { refreshIfStale } = useBusinesses();
  useFocusEffect(
    useCallback(() => {
      void refreshIfStale();
    }, [refreshIfStale]),
  );
};

export const useBusinesses = (): BusinessContextValue => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusinesses debe usarse dentro de un BusinessProvider');
  }
  return context;
};
