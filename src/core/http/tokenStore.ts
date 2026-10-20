/**
 * Fuente única de verdad de los tokens de sesión.
 *
 * Mantiene una copia en memoria para no pegarle a AsyncStorage en cada
 * petición (el v1 hacía tres lecturas asíncronas *por request*), y notifica a
 * quien escuche cuando la sesión se invalida, para que la UI reaccione en vez
 * de quedarse colgada con un token muerto.
 *
 * Desde que el backend **rota** el refresh token —cada renovación devuelve uno
 * nuevo y mata el anterior— guardar el token nuevo dejó de ser opcional: si se
 * conserva el viejo, el siguiente intento se lee como un robo y el servidor
 * cierra la sesión. Por eso `setTokens` persiste siempre los dos.
 */
import { StorageKeys, getItems, removeItems, setItem } from '@/core/storage/storage';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string | null;
  /**
   * Momento (epoch ms) en que vence el access token, derivado del
   * `accessTokenExpiresIn` que devuelven el login y el refresh.
   *
   * Solo vive en memoria: al reabrir la app no se sabe, y entonces se renueva
   * por el camino de siempre (el 401 de la primera petición). Sirve para el
   * caso que de verdad importa —la app abierta un buen rato— donde permite
   * renovar *antes* de que caduque en vez de provocar una ráfaga de 401
   * simultáneos, que es justo lo que el backend interpreta como sospechoso.
   */
  accessTokenExpiresAt?: number | null;
}

/**
 * Margen con el que se considera que el token "ya va a vencer". Un minuto es
 * lo que recomienda el documento del backend: suficiente para que una petición
 * lenta no salga con un token que caduca a mitad de viaje.
 */
const EXPIRY_SKEW_MS = 60_000;

type SessionExpiredListener = () => void;

let cache: SessionTokens | null = null;
let hydrated = false;
const listeners = new Set<SessionExpiredListener>();

/** Carga los tokens persistidos. Idempotente: solo lee del disco una vez. */
export const hydrateTokens = async (): Promise<SessionTokens | null> => {
  if (hydrated) return cache;

  const stored = await getItems([StorageKeys.accessToken, StorageKeys.refreshToken]);
  const accessToken = stored[StorageKeys.accessToken];

  cache = accessToken
    ? {
        accessToken,
        refreshToken: stored[StorageKeys.refreshToken] ?? null,
        // No se persiste: ver `SessionTokens.accessTokenExpiresAt`.
        accessTokenExpiresAt: null,
      }
    : null;
  hydrated = true;

  return cache;
};

/** Tokens actuales sin tocar el disco. `null` si no hay sesión. */
export const getTokens = (): SessionTokens | null => cache;

export const getAccessToken = (): string | null => cache?.accessToken ?? null;

export const getRefreshToken = (): string | null => cache?.refreshToken ?? null;

/**
 * `true` si conviene renovar ya, sin esperar al 401. Devuelve `false` cuando
 * no se conoce el vencimiento (sesión restaurada del disco): ahí el camino
 * reactivo sigue siendo el correcto.
 */
export const isAccessTokenExpiring = (): boolean => {
  const expiresAt = cache?.accessTokenExpiresAt;
  if (!cache?.refreshToken || expiresAt == null) return false;
  return Date.now() >= expiresAt - EXPIRY_SKEW_MS;
};

/** Guarda los tokens en memoria y en disco. */
export const setTokens = async (tokens: SessionTokens): Promise<void> => {
  cache = tokens;
  hydrated = true;
  await setItem(StorageKeys.accessToken, tokens.accessToken);
  if (tokens.refreshToken) {
    await setItem(StorageKeys.refreshToken, tokens.refreshToken);
  } else {
    // Dejar el anterior en disco haría que al reabrir la app se intentara
    // renovar con un token que ya no sirve, y eso hoy cierra la sesión.
    await removeItems([StorageKeys.refreshToken]);
  }
};

/** Borra los tokens de memoria y disco. No notifica a los listeners. */
export const clearTokens = async (): Promise<void> => {
  cache = null;
  hydrated = true;
  await removeItems([StorageKeys.accessToken, StorageKeys.refreshToken]);
};

/**
 * Traduce el `accessTokenExpiresIn` del backend ("15m", "900s", "900") a un
 * instante absoluto. Devuelve `null` si el formato no se reconoce, que para
 * efectos prácticos es lo mismo que no saberlo.
 */
export const expiresAtFrom = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Date.now() + value * 1000;
  }
  if (typeof value !== 'string') return null;

  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  const amount = match?.[1];
  if (!amount) return null;

  const unit = (match?.[2] ?? 's').toLowerCase();
  const factor =
    unit === 'ms'
      ? 1
      : unit === 's'
        ? 1_000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000;

  return Date.now() + Number(amount) * factor;
};

/**
 * Se suscribe al evento "la sesión murió y no se pudo renovar".
 * Devuelve la función para desuscribirse.
 */
export const onSessionExpired = (listener: SessionExpiredListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Lo dispara el interceptor HTTP cuando el refresh falla con un 401. */
export const notifySessionExpired = (): void => {
  listeners.forEach((listener) => listener());
};
