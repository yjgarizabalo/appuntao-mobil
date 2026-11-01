/**
 * Modo de la aplicación: tendero o cliente.
 *
 * La misma persona vive los dos lados del mostrador —atiende su tienda y le
 * fían en la de la esquina—, así que la app funciona como inDriver o Rappi:
 * una sola cuenta, dos modos, y un interruptor para pasar de uno a otro. Cada
 * modo tiene sus propias pestañas; no se mezclan en una sola pantalla porque
 * las preguntas son opuestas ("¿quién me debe?" contra "¿cuánto debo?").
 *
 * Qué justifica que esto sea estado global, cuando la regla del proyecto es
 * que casi nada lo sea:
 *
 *  1. el modo decide qué árbol de navegación se monta, así que lo necesitan a
 *     la vez la puerta de entrada, las dos barras de pestañas y el perfil;
 *  2. se persiste entre sesiones, igual que el negocio activo;
 *  3. las cuentas de cliente deciden si el interruptor lleva a una pantalla
 *     con datos o a la de "todavía no te han vinculado", y esa consulta no
 *     debe repetirse en cada pantalla.
 *
 * Solo se guarda **el modo y el vínculo**. Las deudas de cada tienda las carga
 * la pantalla que las muestra con `useAsyncData`, como el resto de la app.
 */
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

import { type AppError, toAppError } from '@/core/errors/AppError';
import { createLogger } from '@/core/logger';
import { readCache, writeCache } from '@/core/storage/cache';
import { StorageKeys, getItem, setItem } from '@/core/storage/storage';
import type { ClientAccount } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { clientApi } from '@/features/client/api/clientApi';

const log = createLogger('app-mode');

/**
 * Espera antes del único reintento.
 *
 * El backend gratuito se duerme y, mientras despierta, el proxy responde 5xx
 * en vez de esperar. Un reintento corto convierte ese fallo en un arranque
 * normal, y de paso hace que un `warn` en la consola signifique de verdad que
 * algo persiste y no que el servicio estaba estirándose.
 *
 * No es un keep-alive: no hay pings en segundo plano, solo un segundo intento
 * de una petición que el usuario ya provocó al abrir la app.
 */
const RETRY_DELAY_MS = 2500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AppMode = 'merchant' | 'client';

/** Etiquetas en español, en un solo sitio: las usan el interruptor y el perfil. */
export const APP_MODE_LABEL: Record<AppMode, string> = {
  merchant: 'Tendero',
  client: 'Cliente',
};

export const APP_MODE_DESCRIPTION: Record<AppMode, string> = {
  merchant: 'Administra tu negocio: fía, cobra y lleva la cuenta de tus clientes.',
  client: 'Consulta lo que debes en las tiendas donde te fían.',
};

interface AppModeContextValue {
  mode: AppMode;
  /** `false` mientras se lee el modo guardado: la entrada espera a esto. */
  isReady: boolean;
  /** Tiendas donde al usuario le fían. Vacío si nadie lo ha vinculado. */
  accounts: ClientAccount[];
  /** Consulta de vínculos en curso (primera carga). */
  isLoadingAccounts: boolean;
  /** Ya se consultó al servidor al menos una vez en esta sesión. */
  hasLoadedAccounts: boolean;
  /** El usuario es cliente de al menos una tienda. */
  isLinked: boolean;
  /**
   * La última consulta de vínculos falló. Importa distinguirlo de "no tiene
   * tiendas": sin este dato la interfaz afirmaba "todavía nadie te ha
   * vinculado" cuando en realidad no había podido preguntarlo, que es una
   * afirmación que no nos consta.
   */
  accountsError: AppError | null;
  /** Se preguntó, respondió bien, y de verdad no hay ninguna tienda. */
  hasConfirmedNoAccounts: boolean;
  setMode: (mode: AppMode) => void;
  /** Vuelve a consultar los vínculos (tras aceptar una invitación). */
  refreshAccounts: () => Promise<void>;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

const isAppMode = (value: string | null): value is AppMode =>
  value === 'merchant' || value === 'client';

export const AppModeProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useSession();
  const userId = user?.id ?? null;

  const [mode, setModeState] = useState<AppMode>('merchant');
  const [isReady, setIsReady] = useState(false);
  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<AppError | null>(null);

  /**
   * Espejo síncrono de `accounts`, para el `catch` de la carga: hay que saber
   * si ya hay vínculos pintados (de caché) sin esperar a un re-render.
   */
  const accountsRef = useRef<ClientAccount[]>([]);

  /**
   * Generación de carga. El reintento espera unos segundos, y en ese rato el
   * usuario pudo cerrar sesión o entrar otro: si la generación cambió, el
   * resultado que llega es de otra vida y se descarta.
   */
  const loadIdRef = useRef(0);
  const applyAccounts = useCallback((items: ClientAccount[]) => {
    accountsRef.current = items;
    setAccounts(items);
  }, []);

  /* ── Modo guardado ─────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const stored = await getItem(StorageKeys.appMode);
      if (cancelled) return;
      // Sin valor guardado se entra como tendero: es el modo con el que se
      // registra la gran mayoría, y el que tiene salida a todo lo demás.
      if (isAppMode(stored)) setModeState(stored);
      setIsReady(true);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Vínculos como cliente ─────────────────────────────────────────────── */

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    const cacheKey = userId ? `client-accounts:${userId}` : undefined;

    // Rehidratación: evita que el interruptor diga "no estás vinculado" en el
    // arranque en frío mientras el backend gratuito despierta.
    if (cacheKey && accountsRef.current.length === 0) {
      const hit = await readCache<ClientAccount[]>(cacheKey);
      if (hit && hit.data.length > 0) {
        applyAccounts(hit.data);
        setHasLoadedAccounts(true);
      }
    }

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;

    /**
     * Un intento, y si falla por algo reintentable (5xx, red, timeout) otro
     * más tras una pausa. Un 401 o un 403 no se reintentan: reintentar no los
     * arregla.
     */
    const fetchAccounts = async () => {
      try {
        return await clientApi.listAccounts();
      } catch (firstError) {
        const appError = toAppError(firstError);
        if (!appError.isRetryable) throw appError;

        log.info('Reintentando leer el panel del usuario', appError.logContext);
        await wait(RETRY_DELAY_MS);
        if (loadIdRef.current !== loadId) throw appError;
        return clientApi.listAccounts();
      }
    };

    try {
      const items = await fetchAccounts();
      if (loadIdRef.current !== loadId) return;
      applyAccounts(items);
      setAccountsError(null);
      if (cacheKey) void writeCache(cacheKey, items);
    } catch (caught) {
      if (loadIdRef.current !== loadId) return;
      /**
       * Un fallo aquí no bloquea nada: el modo tendero funciona igual y la
       * pantalla de cliente muestra su propio error al cargar. Lo que sí
       * importa es **no** dejar `accounts` vacío pasando por un hecho: se
       * guarda el error para que la interfaz diga "no pudimos consultarlo" en
       * vez de "no tienes tiendas".
       *
       * El caso más común es el arranque en frío del backend gratuito, que
       * responde 5xx mientras despierta; por eso es `warn` y no `error`.
       */
      const appError = toAppError(caught);
      setAccountsError(appError);
      log.warn(
        'No se pudo leer el panel del usuario tras reintentar; el modo cliente queda sin vínculos conocidos (no bloquea nada)',
        appError.logContext,
      );
    } finally {
      // Sin `return` dentro del `finally`: ahí un `return` se traga el flujo
      // del `try`/`catch`. Basta con no tocar el estado si la carga caducó.
      if (loadIdRef.current === loadId) {
        setIsLoadingAccounts(false);
        setHasLoadedAccounts(true);
      }
    }
  }, [applyAccounts, userId]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadAccounts();
    } else {
      // Invalida cualquier carga en vuelo: su resultado ya no es de nadie.
      loadIdRef.current += 1;
      applyAccounts([]);
      setHasLoadedAccounts(false);
      setAccountsError(null);
      // El modo no se arrastra entre cuentas: quien entre después empieza en
      // tendero hasta que elija otra cosa.
      setModeState('merchant');
    }
  }, [isAuthenticated, loadAccounts, applyAccounts]);

  /* ── Acciones ──────────────────────────────────────────────────────────── */

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    void setItem(StorageKeys.appMode, next);
  }, []);

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      isReady,
      accounts,
      isLoadingAccounts,
      hasLoadedAccounts,
      isLinked: accounts.length > 0,
      accountsError,
      hasConfirmedNoAccounts:
        hasLoadedAccounts && accountsError === null && accounts.length === 0,
      setMode,
      refreshAccounts: loadAccounts,
    }),
    [
      mode,
      isReady,
      accounts,
      isLoadingAccounts,
      hasLoadedAccounts,
      accountsError,
      setMode,
      loadAccounts,
    ],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};

export const useAppMode = (): AppModeContextValue => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode debe usarse dentro de un AppModeProvider');
  }
  return context;
};
