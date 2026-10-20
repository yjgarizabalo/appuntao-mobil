/**
 * API de autenticación y de usuario.
 *
 * Unifica lo que en el v1 estaban en tres archivos con tres clases de error
 * distintas (`authService.ts`, `registerUsers.ts`, `userService.ts`, más un
 * `registerBussiness.ts` vacío). Todo pasa por el mismo cliente HTTP, así que
 * hereda timeout, logging redactado y conversión de errores.
 *
 * Tras el endurecimiento del backend hay tres cosas que ya no son opcionales:
 *
 *  - el login manda `deviceId` (y `deviceName`), porque la sesión es **por
 *    dispositivo**: sin él responde 400;
 *  - la contraseña se cambia en su propio endpoint, pidiendo la actual;
 *  - el perfil solo admite nombre y apellido. Mandar correo, teléfono o
 *    documento responde 403, así que ni siquiera se envían.
 */
import { env } from '@/core/config/env';
import { getDeviceName, hydrateDeviceId } from '@/core/device/deviceIdentity';
import { http, skipAuthRefresh } from '@/core/http/client';
import { expiresAtFrom } from '@/core/http/tokenStore';
import { toItem } from '@/core/http/payload';
import type { DocumentType } from '@/domain/constants';
import { mapUser } from '@/domain/mappers';
import type { User } from '@/domain/models';

export interface LoginCredentials {
  /** Correo, teléfono o número de documento: el backend acepta los tres. */
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string | null;
  /** Instante (epoch ms) en que vence el access token. `null` si no se sabe. */
  accessTokenExpiresAt: number | null;
  user: User;
}

/**
 * Lo único que el usuario puede cambiar de su propia cuenta. El correo, el
 * teléfono, el documento y el rol los reserva el backend al administrador.
 */
export interface ProfilePayload {
  firstName?: string;
  lastName?: string;
}

export interface LogoutOptions {
  /** Cierra la sesión en todos los dispositivos, no solo en este. */
  allDevices?: boolean;
}

const AUTH = env.authPrefix;

export const authApi = {
  /** `POST /auth/login` */
  login: async (credentials: LoginCredentials): Promise<AuthSession> => {
    // Se asegura de que el identificador de la instalación exista antes de
    // pedir nada: es obligatorio y crearlo es idempotente.
    const deviceId = await hydrateDeviceId();

    const { data } = await http.post(
      `${AUTH}/login`,
      {
        ...credentials,
        deviceId,
        deviceName: getDeviceName(),
      },
      {
        // Un 401 aquí son credenciales malas, no una sesión expirada: no tiene
        // sentido intentar renovar el token.
        ...skipAuthRefresh,
      },
    );

    return {
      accessToken: String(data?.accessToken ?? ''),
      refreshToken: data?.refreshToken ? String(data.refreshToken) : null,
      accessTokenExpiresAt: expiresAtFrom(data?.accessTokenExpiresIn),
      user: mapUser(data?.user),
    };
  },

  /**
   * `POST /users` — el registro crea el usuario, no inicia sesión.
   *
   * No se envía `role`: el backend lo ignora y toda cuenta nueva nace `USER`.
   */
  register: async (payload: RegisterPayload): Promise<User> => {
    const { data } = await http.post('/users', payload, { ...skipAuthRefresh });
    return mapUser(toItem(data));
  },

  /**
   * `POST /auth/logout` — invalida el refresh token en el servidor.
   *
   * El body va como objeto, no `null`: con `Content-Type: application/json`,
   * axios serializa `null` al literal `"null"`, y el `body-parser` de Express
   * (modo estricto) lo rechaza con un 400 porque no empieza por `{` ni `[` —
   * nunca llega a tocar el controlador.
   *
   * Con `allDevices` el backend cierra todas las sesiones del usuario, y en
   * ese caso **sí** responde 401 si el token ya no vale (sin la bandera lo
   * perdona). Quien llame debe limpiar la sesión local pase lo que pase.
   */
  logout: async (refreshToken: string, options: LogoutOptions = {}): Promise<void> => {
    await http.post(
      `${AUTH}/logout`,
      options.allDevices ? { allDevices: true } : {},
      {
        headers: { 'x-refresh-token': refreshToken },
        ...skipAuthRefresh,
      },
    );
  },

  /** `PATCH /users/:id` — solo nombre y apellido (ver `ProfilePayload`). */
  updateProfile: async (userId: string, payload: ProfilePayload): Promise<void> => {
    await http.patch(`/users/${userId}`, payload);
  },

  /**
   * `PATCH /users/me/password` — cambio de contraseña.
   *
   * Pide la contraseña actual y, al tener éxito, el backend **cierra todas las
   * sesiones del usuario**: quien llame tiene que mandarlo al login.
   */
  updatePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<void> => {
    await http.patch('/users/me/password', { currentPassword, newPassword });
  },
};
