/**
 * Estado de la conexión a internet.
 *
 * Hasta ahora la app solo se enteraba de que no había red **después** de que
 * una petición fallara: cada pantalla mostraba su `ErrorState` y un formulario
 * esperaba al timeout antes de decir nada. Con `expo-network` el sistema
 * operativo nos lo dice de antemano, así que podemos avisar antes de intentar
 * y recuperarnos solos cuando la conexión vuelve.
 *
 * Está en un archivo suelto de `core/` —como `haptics.ts`— y no en
 * `core/hooks/` porque lo consumen dos mundos distintos: React, a través de
 * `useConnectivity()`, y el interceptor de axios, que no es un componente y
 * necesita leer el estado de forma síncrona. Mantener las dos puertas sobre la
 * misma función evita que la interfaz diga una cosa y la capa de red otra.
 *
 * Nota sobre `isInternetReachable`: en iOS siempre vale lo mismo que
 * `isConnected`; en Android distingue el caso de estar pegado a un wifi que no
 * sale a internet (el del café con portal cautivo), que para nosotros es tan
 * "sin conexión" como no tener señal. Solo se considera caída cuando alguno de
 * los dos es `false` **explícito**: mientras el valor es desconocido se asume
 * que hay red, porque bloquear por una duda es peor que dejar fallar una
 * petición.
 */
import * as Network from 'expo-network';
import { useMemo } from 'react';

import { createLogger } from '@/core/logger';

const log = createLogger('connectivity');

/** Traduce el estado del sistema a la única pregunta que nos importa. */
const resolveOffline = (state: Network.NetworkState | null | undefined): boolean =>
  state?.isConnected === false || state?.isInternetReachable === false;

/* ── Espejo síncrono, para quien no es un componente ──────────────────────── */

let offline = false;

/**
 * ¿Estamos sin internet, según lo último que reportó el sistema?
 *
 * Lo usa el interceptor de peticiones para rechazar al instante en vez de
 * dejar que la petición agonice hasta el timeout (60 s en este proyecto, por
 * el arranque en frío del backend gratuito). Es una lectura optimista: si el
 * espejo todavía no se ha poblado, responde que sí hay red.
 */
export const isOffline = (): boolean => offline;

const sync = (state: Network.NetworkState) => {
  const next = resolveOffline(state);
  if (next === offline) return;
  offline = next;
  log.info(next ? 'Sin conexión a internet' : 'Conexión restablecida');
};

/**
 * La suscripción se abre al importar el módulo. Va envuelta porque en web el
 * módulo nativo no existe y una excepción aquí tumbaría el arranque entero por
 * algo que es, como mucho, una comodidad.
 */
try {
  void Network.getNetworkStateAsync().then(sync).catch(() => undefined);
  Network.addNetworkStateListener(sync);
} catch {
  log.warn('No se pudo observar el estado de la red en esta plataforma');
}

/* ── Puerta de React ──────────────────────────────────────────────────────── */

export interface ConnectivityState {
  /** No hay internet: ni red, ni salida a internet por la red que hay. */
  isOffline: boolean;
  isOnline: boolean;
}

/**
 * Estado de conexión para componentes. Se re-renderiza cuando cambia.
 *
 * `useNetworkState()` de `expo-network` mantiene su propia suscripción, así
 * que el valor que devuelve y el del espejo síncrono salen de la misma fuente
 * del sistema; se traducen con la misma función para que no puedan discrepar.
 */
export const useConnectivity = (): ConnectivityState => {
  const state = Network.useNetworkState();
  const value = resolveOffline(state);

  return useMemo(() => ({ isOffline: value, isOnline: !value }), [value]);
};
