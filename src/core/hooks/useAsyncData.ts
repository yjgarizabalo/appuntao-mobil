/**
 * Carga de datos asíncronos con estados explícitos.
 *
 * El v1 mezclaba `isLoading`, `pageLoading`, `initialLoadDone` y refs en cada
 * pantalla. Aquí hay una máquina de estados clara —`idle → loading → success |
 * error`— más `refreshing` para el pull-to-refresh, que es un estado distinto:
 * durante un refresh la lista sigue visible.
 *
 * También cancela: si la pantalla se desmonta o llega una carga más reciente,
 * el resultado viejo se descarta en vez de sobrescribir el estado.
 *
 * Caché offline (opcional, con `cacheKey`): la última respuesta buena se guarda
 * en disco y se rehidrata al montar (stale-while-revalidate). Sirve para el
 * backend gratuito que se duerme: al reabrir la app se ve al instante lo último
 * cargado y, si la red falla mientras el servicio despierta, se conserva lo
 * guardado en vez de mostrar un error. Ver `src/core/storage/cache.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useConnectivity } from '@/core/connectivity';
import { type AppError, toAppError } from '@/core/errors/AppError';
import { createLogger } from '@/core/logger';
import { isCacheStale, readCache, writeCache } from '@/core/storage/cache';

const log = createLogger('async-data');

/** Caché más fresca que este tiempo se usa sin ir a la red. */
const CACHE_TTL_DEFAULT_MS = 10 * 60 * 1000;

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAsyncDataResult<T> {
  data: T | null;
  status: AsyncStatus;
  error: AppError | null;
  /** Primera carga en curso (no hay datos que mostrar todavía). */
  isLoading: boolean;
  /** Recarga con datos ya en pantalla (pull-to-refresh). */
  isRefreshing: boolean;
  /**
   * Los datos que se ven vienen de la caché y aún no los confirmó la red en esta
   * sesión (el servidor puede estar despertando). Sirve para un aviso sutil.
   */
  isStale: boolean;
  /** Vuelve a ejecutar la carga mostrando el skeleton. */
  reload: () => Promise<void>;
  /** Vuelve a ejecutar la carga manteniendo los datos visibles. */
  refresh: () => Promise<void>;
  /** Actualiza los datos en local, sin ir al servidor (updates optimistas). */
  setData: (updater: T | ((previous: T | null) => T | null)) => void;
}

export interface UseAsyncDataOptions {
  /** Si es `false`, no carga hasta que pase a `true`. Útil si falta un id. */
  enabled?: boolean;
  /** Dependencias que, al cambiar, disparan una recarga. */
  deps?: readonly unknown[];
  /**
   * Llave de caché. Si se define, la última respuesta buena se persiste y se
   * rehidrata al montar. Debe ser única por contexto (usuario + negocio + …)
   * para no mezclar los datos de una cuenta con los de otra.
   */
  cacheKey?: string;
  /**
   * TTL en ms. Caché más fresca que esto se usa directamente sin ir a la red.
   * Default: 10 minutos. Pasar `0` para forzar siempre la red (comportamiento
   * del v1: stale-while-revalidate sin límite de tiempo).
   */
  cacheTtlMs?: number;
}

export const useAsyncData = <T>(
  fetcher: () => Promise<T>,
  { enabled = true, deps = [], cacheKey, cacheTtlMs }: UseAsyncDataOptions = {},
): UseAsyncDataResult<T> => {
  const [data, setDataState] = useState<T | null>(null);
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<AppError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  const cacheTtlMsRef = useRef(cacheTtlMs);
  cacheTtlMsRef.current = cacheTtlMs;

  /**
   * Espejo síncrono de `data`. En el `catch` de una carga async necesitamos
   * saber si ya hay algo en pantalla (de caché o de una carga previa) sin
   * esperar a que React vuelva a renderizar; por eso se mantiene aparte.
   */
  const dataRef = useRef<T | null>(null);

  const mountedRef = useRef(true);
  /** Cada ejecución recibe un id; solo la más reciente puede escribir estado. */
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Escribe `data` y su espejo a la vez. */
  const commitData = useCallback((value: T | null) => {
    dataRef.current = value;
    setDataState(value);
  }, []);

  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const key = cacheKeyRef.current;
      const ttlMs = cacheTtlMsRef.current ?? CACHE_TTL_DEFAULT_MS;

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        // Carga "fresca": se parte de cero para no mezclar el contexto anterior
        // (p. ej. otro negocio) con lo que va a hidratar la nueva llave.
        if (key) commitData(null);
        setStatus('loading');
        setIsStale(false);
      }
      setError(null);

      // Con TTL: primero se lee el caché y se decide si la red es necesaria.
      // Caché fresca (< ttlMs) → se pinta y se sale; no se toca el servidor.
      // Caché vencida → se pinta mientras se lanza la red en segundo plano.
      if (key && mode === 'load') {
        const hit = await readCache<T>(key);
        if (!mountedRef.current || runIdRef.current !== runId) return;

        if (hit) {
          const expired = isCacheStale(hit.savedAt, ttlMs);
          if (dataRef.current === null) {
            commitData(hit.data);
            setStatus('success');
            setIsStale(expired);
          }
          if (!expired) return;
        }
      }

      try {
        const result = await fetcherRef.current();
        if (!mountedRef.current || runIdRef.current !== runId) return;
        commitData(result);
        setStatus('success');
        setIsStale(false);
        setError(null);
        if (key) void writeCache(key, result);
      } catch (caught) {
        if (!mountedRef.current || runIdRef.current !== runId) return;
        const appError = toAppError(caught);
        // Una cancelación no es un error que deba pintarse en pantalla.
        if (appError.code === 'CANCELLED') return;

        // Si ya hay algo que mostrar (caché o carga previa), no se rompe la
        // pantalla: se conserva y se marca como no confirmado. Así el servidor
        // dormido no deja al usuario sin datos.
        if (dataRef.current !== null) {
          setStatus('success');
          setIsStale(true);
          log.warn('Revalidación fallida; se conservan los datos en caché', {
            code: appError.code,
          });
          return;
        }

        /**
         * Sin datos en memoria, el disco es el último recurso antes de romper
         * la pantalla.
         *
         * Hace falta por una carrera real: casi todas las pantallas disparan
         * `refresh()` al recibir el foco, y el foco llega en el **mismo**
         * montaje en que corre la carga inicial. Esa carga está esperando a
         * `readCache` cuando el refresh incrementa `runId`, así que al volver
         * del disco se descarta sin pintar nada. Si entonces la red falla,
         * `dataRef` sigue vacío y el usuario veía "Problema del servidor"
         * teniendo datos perfectamente buenos guardados.
         *
         * Se reproducía al cambiar de modo y volver: cada cambio remonta la
         * pantalla y repite la carrera.
         */
        const fallback = key ? await readCache<T>(key) : null;
        if (!mountedRef.current || runIdRef.current !== runId) return;

        if (fallback) {
          commitData(fallback.data);
          setStatus('success');
          setIsStale(true);
          log.warn('Carga fallida; se muestran los datos guardados en disco', {
            code: appError.code,
          });
          return;
        }

        setError(appError);
        setStatus('error');
      } finally {
        if (mountedRef.current && runIdRef.current === runId && mode === 'refresh') {
          setIsRefreshing(false);
        }
      }
    },
    [commitData],
  );

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    void run('load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, cacheKey, ...deps]);

  /* ── Recuperación al volver la conexión ─────────────────────────────────── */

  const { isOnline } = useConnectivity();
  const wasOnlineRef = useRef(true);

  /**
   * Al recuperar internet se recarga sola, sin que el usuario tenga que
   * arrastrar ni tocar "Reintentar".
   *
   * Es lo que la pantalla de sin conexión le promete ("en cuanto vuelvas a
   * tener señal, esto se actualiza solo"), y aquí es donde se cumple: como
   * todas las pantallas cargan con este hook, basta ponerlo una vez.
   *
   * Solo actúa en la transición caída → recuperada. Si ya había datos se usa
   * `refresh`, que los mantiene en pantalla mientras revalida; si no había
   * nada, `load`, que pinta el esqueleto.
   */
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!isOnline || wasOnline || !enabled) return;
    void run(dataRef.current === null ? 'load' : 'refresh');
  }, [isOnline, enabled, run]);

  const setData = useCallback(
    (updater: T | ((previous: T | null) => T | null)) => {
      setDataState((previous) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: T | null) => T | null)(previous)
            : updater;
        dataRef.current = next;
        return next;
      });
    },
    [],
  );

  return {
    data,
    status,
    error,
    isLoading: status === 'loading',
    isRefreshing,
    isStale,
    reload: useCallback(() => run('load'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
    setData,
  };
};
