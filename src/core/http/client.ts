/**
 * Cliente HTTP de la aplicación.
 *
 * Qué resuelve, más allá de hacer peticiones:
 *
 *  1. El refresh token viaja como **header** (`x-refresh-token`), acompañado
 *     del `x-device-id` de la instalación. En el v1 iba dentro del body por un
 *     error de firma de `axios.post`, así que la renovación nunca funcionaba.
 *  2. **Una sola renovación a la vez** (single-flight). Esto dejó de ser una
 *     optimización y pasó a ser obligatorio: el backend rota el refresh token
 *     y, si recibe dos renovaciones con el mismo, lo lee como un robo y cierra
 *     la sesión. La promesa compartida garantiza que nunca salgan dos.
 *  3. **Renovación anticipada.** Si al access token le queda menos de un
 *     minuto, se renueva antes de enviar la petición. Así se evita de raíz la
 *     ráfaga de 401 simultáneos que se produce cuando la app lleva rato
 *     abierta y varias pantallas recargan a la vez.
 *  4. **Un fallo de red al renovar no cierra la sesión.** Solo un 401 lo hace.
 *     Con el backend dormido del plan gratuito, lo contrario significaba echar
 *     al usuario por un arranque en frío.
 *  5. El token se lee de memoria (`tokenStore`), no con lecturas asíncronas a
 *     AsyncStorage en cada request; nunca se imprimen tokens (el logger los
 *     redacta) y todo error sale ya convertido a `AppError`.
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/core/config/env';
import { isOffline } from '@/core/connectivity';
import { getDeviceId } from '@/core/device/deviceIdentity';
import { AppError, toAppError } from '@/core/errors/AppError';
import { toHttpAppError } from './httpError';
import {
  clearTokens,
  expiresAtFrom,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpiring,
  notifySessionExpired,
  setTokens,
} from './tokenStore';
import { createLogger } from '@/core/logger';

const log = createLogger('http');

/** Marca interna para no reintentar una petición más de una vez. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  /** Si es `true`, el interceptor no intenta renovar la sesión en un 401. */
  _skipAuthRefresh?: boolean;
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.timeoutMs,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

/* ── Request: corta si no hay red, renueva si toca y adjunta el token ─────── */

http.interceptors.request.use(async (config) => {
  /**
   * Sin internet no se intenta siquiera.
   *
   * El timeout de este proyecto son 60 s —hay que darle margen al arranque en
   * frío del backend gratuito—, así que dejar salir la petición significaba
   * que un formulario se quedaba un minuto girando antes de decir nada. Se
   * rechaza con el mismo `AppError('NETWORK')` que produciría la red al
   * fallar, de modo que cada pantalla muestra el mensaje que ya tiene escrito
   * ("Sin conexión…") sin ningún cambio.
   *
   * El interceptor de respuesta lo deja pasar tal cual: `toHttpAppError`
   * devuelve los `AppError` sin tocarlos.
   */
  if (isOffline()) {
    log.debug(`✕ ${config.method?.toUpperCase()} ${config.url} — sin conexión`);
    throw new AppError('NETWORK');
  }

  /**
   * Renovación anticipada: si el token está por vencer se cambia ahora, con
   * una sola petición compartida, en vez de dejar que cada llamada en vuelo
   * choque contra su propio 401.
   *
   * Si falla no se bloquea la petición: puede ser un bache de red y el token
   * viejo quizá todavía sirva. Si de verdad murió, el 401 de la respuesta
   * cierra la sesión por el camino de siempre.
   */
  const retriable = config as RetriableConfig;
  if (!retriable._skipAuthRefresh && isAccessTokenExpiring()) {
    try {
      await refreshAccessToken();
    } catch (caught) {
      log.debug('La renovación anticipada falló; sigue la petición', {
        code: toAppError(caught).code,
      });
    }
  }

  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
  });
  return config;
});

/* ── Renovación de sesión (single-flight) ─────────────────────────────────── */

let refreshInFlight: Promise<string> | null = null;

interface RefreshResponse {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresIn?: string | number;
}

const requestNewAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AppError('UNAUTHORIZED', { message: 'No hay refresh token guardado.' });
  }

  // El `deviceId` ata la renovación al aparato donde nació la sesión. Es
  // opcional para el backend, pero si se envía y no coincide responde 401, así
  // que un token robado no sirve desde otro teléfono.
  const deviceId = getDeviceId();

  // Se usa `axios` directo (no `http`) para no volver a entrar en este mismo
  // interceptor y provocar una recursión infinita.
  const response = await axios.post<RefreshResponse>(
    `${env.apiBaseUrl}${env.authPrefix}/refresh`,
    null,
    {
      timeout: env.timeoutMs,
      headers: {
        Accept: 'application/json',
        'x-refresh-token': refreshToken,
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
      },
    },
  );

  const accessToken = response.data?.accessToken;
  if (!accessToken) {
    throw new AppError('UNAUTHORIZED', {
      message: 'El servidor no devolvió un token nuevo.',
    });
  }

  await setTokens({
    accessToken,
    /**
     * El backend rota el refresh token: el de la respuesta es el único que
     * servirá la próxima vez. El `??` solo cubre una versión del backend que
     * todavía no rote; con la actual siempre llega uno nuevo, y quedarse con
     * el anterior provocaría el cierre de sesión "por seguridad".
     */
    refreshToken: response.data.refreshToken ?? refreshToken,
    accessTokenExpiresAt: expiresAtFrom(response.data.accessTokenExpiresIn),
  });

  log.info('Sesión renovada');
  return accessToken;
};

/**
 * Renueva el token reutilizando la renovación en curso si ya hay una.
 *
 * Centraliza también el cierre de sesión: solo un 401 significa "esta sesión
 * ya no existe". Un fallo de red o un 502 del servidor despertando no deben
 * echar al usuario, así que el error se propaga y la pantalla ofrece
 * reintentar con los datos que tenga en caché.
 */
const refreshAccessToken = (): Promise<string> => {
  refreshInFlight ??= requestNewAccessToken()
    .catch(async (caught: unknown) => {
      const error = toHttpAppError(caught);

      if (error.code === 'UNAUTHORIZED') {
        log.warn('El backend rechazó la renovación; se cierra la sesión', error.logContext);
        await clearTokens();
        notifySessionExpired();
      } else {
        log.warn('No se pudo renovar la sesión; se conserva para reintentar', error.logContext);
      }

      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

/* ── Response: renueva en 401 y normaliza errores ─────────────────────────── */

/** Token que llevaba una petición, para saber si quedó obsoleto. */
const bearerOf = (value: unknown): string | null =>
  typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const canRetry =
      status === 401 &&
      config !== undefined &&
      !config._retried &&
      !config._skipAuthRefresh &&
      getRefreshToken() !== null;

    if (!canRetry) {
      return Promise.reject(toHttpAppError(error));
    }

    config._retried = true;

    /**
     * Si otra petición ya renovó la sesión mientras esta viajaba, el 401 es de
     * un token que quedó atrás: basta reintentar con el vigente. Renovar otra
     * vez gastaría una rotación de más sin ninguna razón.
     */
    const sentToken = bearerOf(config.headers?.Authorization);
    const currentToken = getAccessToken();
    if (currentToken && sentToken && sentToken !== currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
      return http(config);
    }

    try {
      const accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
      return http(config);
    } catch (refreshError) {
      const failure = toAppError(refreshError);

      // El cierre de sesión, si tocaba, ya lo hizo `refreshAccessToken`. Aquí
      // solo se decide qué ve el usuario: el motivo que dio el backend ("La
      // sesión se cerró por seguridad…") pesa más que cualquier texto nuestro.
      if (failure.code !== 'UNAUTHORIZED') {
        return Promise.reject(failure);
      }

      return Promise.reject(
        new AppError('UNAUTHORIZED', {
          title: 'Sesión finalizada',
          message: failure.message || 'Tu sesión expiró. Vuelve a iniciar sesión.',
          cause: refreshError,
        }),
      );
    }
  },
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Header de negocio activo. Los recursos de clientes, deudas y pagos son
 * multi-tenant y el backend los filtra con `x-business-id`.
 */
export const businessHeader = (businessId: string) => ({
  headers: { 'x-business-id': businessId },
});

/** Config para peticiones que no deben disparar el refresh (login, logout). */
export const skipAuthRefresh = { _skipAuthRefresh: true } as Partial<RetriableConfig>;
