/**
 * Sesión del usuario.
 *
 * Diferencias clave con el `AuthContext` del v1:
 *  1. Expone un `status` explícito (`loading` / `authenticated` /
 *     `unauthenticated`) en lugar de un `isLoading` suelto. La pantalla de
 *     arranque decide con eso, y así se corrige el bug del v1, donde
 *     `app/index.tsx` tenía `isAuthenticated = false` fijo y **siempre**
 *     mandaba al login aunque hubiera sesión guardada.
 *  2. Escucha `onSessionExpired`: si el refresh token muere a mitad de uso, la
 *     app cierra sesión sola y vuelve al login, en vez de quedarse con un
 *     token muerto lanzando 401 en cada pantalla.
 *  3. `logout` siempre limpia el estado local, incluso si la llamada al
 *     backend falla (el usuario pidió salir: hay que sacarlo).
 *
 * Con la sesión por dispositivo se suma un cuarto punto: al arrancar también
 * se carga el `deviceId` de la instalación, que el login necesita sí o sí y
 * el refresh usa para probar que renueva desde el mismo aparato. Ese valor
 * **no** se borra al cerrar sesión: identifica el teléfono, no a la persona.
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { hydrateDeviceId } from '@/core/device/deviceIdentity';
import { AppError, toAppError } from '@/core/errors/AppError';
import {
  clearTokens,
  getRefreshToken,
  hydrateTokens,
  onSessionExpired,
  setTokens,
} from '@/core/http/tokenStore';
import { createLogger } from '@/core/logger';
import { clearCache } from '@/core/storage/cache';
import { StorageKeys, getJson, removeItems, setJson } from '@/core/storage/storage';
import type { User } from '@/domain/models';
import {
  type LoginCredentials,
  type LogoutOptions,
  type RegisterPayload,
  authApi,
} from '@/features/auth/api/authApi';

const log = createLogger('session');

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<User>;
  /** Cierra sesión avisando al backend. Con `allDevices` cierra todas. */
  logout: (options?: LogoutOptions) => Promise<void>;
  /**
   * Cierra la sesión **solo en local**, sin llamar al backend. Para cuando el
   * servidor ya la invalidó por su cuenta: hoy, al cambiar la contraseña.
   */
  endSession: () => Promise<void>;
  /** Actualiza el usuario en memoria y en disco (tras editar el perfil). */
  patchUser: (changes: Partial<User>) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  /* ── Rehidratación al arrancar ─────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const [tokens, storedUser] = await Promise.all([
        hydrateTokens(),
        getJson<User>(StorageKeys.user),
        // No se espera su valor aquí, pero sí que esté listo antes de que
        // alguien intente renovar la sesión o iniciar una nueva.
        hydrateDeviceId(),
      ]);

      if (cancelled) return;

      if (tokens?.accessToken && storedUser) {
        setUser(storedUser);
        setStatus('authenticated');
        log.info('Sesión restaurada');
      } else {
        // Estado inconsistente (token sin usuario o al revés): se limpia.
        if (tokens?.accessToken || storedUser) {
          await clearSession();
        }
        setStatus('unauthenticated');
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Acciones ──────────────────────────────────────────────────────────── */

  /** Deja el dispositivo sin sesión. No habla con el backend. */
  const endSession = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  /* ── Cierre de sesión forzado por el interceptor HTTP ──────────────────── */

  useEffect(
    () =>
      onSessionExpired(() => {
        log.warn('Sesión expirada: se cierra la sesión local');
        void endSession();
      }),
    [endSession],
  );

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await authApi.login(credentials);

    if (!session.accessToken) {
      throw new AppError('UNKNOWN', {
        message: 'El servidor no devolvió un token de acceso.',
      });
    }

    await setTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    });
    await setJson(StorageKeys.user, session.user);

    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(
    (payload: RegisterPayload) => authApi.register(payload),
    [],
  );

  const logout = useCallback(
    async (options: LogoutOptions = {}) => {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        try {
          await authApi.logout(refreshToken, options);
        } catch (caught) {
          // Que el backend no pueda invalidar el token no debe impedir salir.
          // Con `allDevices` incluso puede responder 401 si el token ya murió;
          // da igual, el usuario pidió salir de este dispositivo.
          log.warn('El logout remoto falló; se cierra igualmente en local', {
            code: toAppError(caught).code,
          });
        }
      }

      await endSession();
    },
    [endSession],
  );

  const patchUser = useCallback(
    async (changes: Partial<User>) => {
      const next = { ...(user ?? ({} as User)), ...changes } as User;
      setUser(next);
      await setJson(StorageKeys.user, next);
    },
    [user],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      endSession,
      patchUser,
    }),
    [status, user, login, register, logout, endSession, patchUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

/**
 * Borra tokens, datos locales de la sesión y la caché de datos de negocio.
 *
 * `StorageKeys.deviceId` queda intacto a propósito: es la identidad del
 * aparato ante el backend y regenerarlo en cada salida dejaría sesiones
 * huérfanas del lado del servidor.
 */
const clearSession = async () => {
  await clearTokens();
  await removeItems([StorageKeys.user, StorageKeys.activeBusinessId, StorageKeys.appMode]);
  // La caché offline pertenece al usuario que sale: se limpia para que la
  // siguiente cuenta que entre en el dispositivo no vea datos ajenos.
  await clearCache();
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de un SessionProvider');
  }
  return context;
};
