/**
 * Ingreso rápido: recordar el usuario y la contraseña en el teléfono y
 * entregarlos solo después de que el sistema confirme que quien lo usa es su
 * dueño (huella, rostro o bloqueo de pantalla).
 *
 * Es **opcional**: se activa marcando "Recordar mis datos" al iniciar sesión y
 * se apaga desde el perfil. Nada se guarda sin esa casilla.
 *
 * Por qué se guarda la contraseña y no el refresh token: la sesión ya
 * sobrevive en el teléfono mientras no se cierre; esto sirve justo para
 * después de cerrarla, y el backend invalida el refresh token en el logout.
 * Repetir el login normal con las credenciales es lo único que no depende de
 * un token que el servidor ya borró.
 *
 * Dónde vive cada dato:
 *  - la contraseña y la cuenta (id, identificador, nombre), cifradas en
 *    `SecureStore` (Keychain / Keystore);
 *  - una **marca** con el `userId` en AsyncStorage. AsyncStorage se borra al
 *    desinstalar la app y el llavero de iOS no: sin marca, lo que quede en el
 *    llavero es de una instalación anterior y se descarta. Sin esto, alguien
 *    que reinstala la app la encontraría recordando una cuenta.
 *
 * El límite, dicho tal cual en la pantalla: quien pueda desbloquear el
 * teléfono puede entrar con la cuenta recordada. Por eso el texto pide
 * activarlo solo en un celular propio.
 */
import {
  type DeviceAuthKind,
  authenticateOwner,
  deviceAuthLabel,
  getDeviceAuthSupport,
} from '@/core/device/deviceAuth';
import { createLogger } from '@/core/logger';
import {
  SecureKeys,
  getSecureItem,
  isSecureStorageAvailable,
  removeSecureItems,
  setSecureItem,
} from '@/core/storage/secureStorage';
import { StorageKeys, getItem, removeItems, setItem } from '@/core/storage/storage';

const log = createLogger('remembered-login');

export interface RememberedAccount {
  /** Dueño de los datos: decide si el perfil muestra el ingreso rápido activo. */
  userId: string;
  /** Lo que escribió para entrar: correo, celular o documento. */
  identifier: string;
  /** Para saludar: "Hola de nuevo, Ana". */
  firstName: string;
}

export interface RememberedCredentials {
  identifier: string;
  password: string;
}

export type UnlockResult =
  | { status: 'unlocked'; credentials: RememberedCredentials }
  /** La persona cerró el aviso: no se muestra nada. */
  | { status: 'cancelled' }
  | {
      status: 'error';
      /** Título y mensaje ya escritos para el usuario. */
      title: string;
      message: string;
      /** Se borraron los datos guardados: hay que entrar con la contraseña. */
      forgotten: boolean;
    };

/* ── Lectura ──────────────────────────────────────────────────────────────── */

const parseAccount = (raw: string | null): RememberedAccount | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<RememberedAccount>;
    if (typeof data.userId !== 'string' || typeof data.identifier !== 'string') return null;
    return {
      userId: data.userId,
      identifier: data.identifier,
      firstName: typeof data.firstName === 'string' ? data.firstName : '',
    };
  } catch {
    return null;
  }
};

/** Cuenta recordada en este teléfono, o `null`. No pide autenticación. */
export const readRememberedAccount = async (): Promise<RememberedAccount | null> => {
  const ownerId = await getItem(StorageKeys.rememberedLogin);

  if (!ownerId) {
    // Lo que haya en el llavero es de una instalación anterior.
    await removeSecureItems([SecureKeys.rememberedAccount, SecureKeys.rememberedPassword]);
    return null;
  }

  const account = parseAccount(await getSecureItem(SecureKeys.rememberedAccount));
  if (!account || account.userId !== ownerId) {
    // Marca sin datos (p. ej. un respaldo de Android restaurado en otro
    // teléfono, que trae AsyncStorage pero no el Keystore) o datos corruptos.
    await forgetRememberedLogin();
    return null;
  }

  return account;
};

/* ── Escritura ────────────────────────────────────────────────────────────── */

/**
 * Guarda la cuenta y su contraseña, reemplazando las de cualquier otra cuenta.
 * Devuelve `false` si el teléfono no puede protegerlas o si algo falló; en ese
 * caso no queda nada a medias.
 */
export const rememberLogin = async (
  account: RememberedAccount,
  password: string,
): Promise<boolean> => {
  const [support, canStore] = await Promise.all([
    getDeviceAuthSupport(),
    isSecureStorageAvailable(),
  ]);
  // Sin bloqueo de pantalla nada protegería la contraseña: no se guarda.
  if (support.status !== 'available' || !canStore) return false;

  const saved =
    (await setSecureItem(SecureKeys.rememberedAccount, JSON.stringify(account))) &&
    (await setSecureItem(SecureKeys.rememberedPassword, password)) &&
    (await setItem(StorageKeys.rememberedLogin, account.userId));

  if (!saved) {
    log.warn('No se pudieron recordar los datos de ingreso');
    await forgetRememberedLogin();
  }
  return saved;
};

/** Borra los datos recordados, sean de quien sean. */
export const forgetRememberedLogin = async (): Promise<void> => {
  await removeItems([StorageKeys.rememberedLogin]);
  await removeSecureItems([SecureKeys.rememberedAccount, SecureKeys.rememberedPassword]);
};

/**
 * Borra los datos recordados solo si son de este usuario. Al eliminar o
 * desactivar una cuenta, o al entrar sin la casilla marcada, no se tocan los
 * de otra persona que comparte el teléfono.
 */
export const forgetRememberedLoginOf = async (userId: string): Promise<void> => {
  const ownerId = await getItem(StorageKeys.rememberedLogin);
  if (ownerId === userId) await forgetRememberedLogin();
};

/**
 * Tras cambiar la contraseña, reemplaza la recordada por la nueva (si la
 * cuenta recordada es esta). Así el siguiente ingreso —que el cambio obliga,
 * porque el backend cierra todas las sesiones— sigue siendo con la huella.
 * Si no se puede guardar, se borra: una contraseña vieja ya no sirve.
 */
export const updateRememberedPassword = async (
  userId: string,
  password: string,
): Promise<void> => {
  const ownerId = await getItem(StorageKeys.rememberedLogin);
  if (ownerId !== userId) return;
  const saved = await setSecureItem(SecureKeys.rememberedPassword, password);
  if (!saved) await forgetRememberedLogin();
};

/* ── Ingreso ──────────────────────────────────────────────────────────────── */

/**
 * Pide la autenticación del teléfono y, solo si pasa, lee la contraseña.
 * La contraseña no se lee antes: no está en memoria mientras nadie la pide.
 */
export const unlockRememberedLogin = async (
  account: RememberedAccount,
  kind: DeviceAuthKind,
): Promise<UnlockResult> => {
  const label = deviceAuthLabel(kind);
  const outcome = await authenticateOwner(
    account.firstName ? `Entrar como ${account.firstName}` : 'Entrar a Appuntao',
  );

  if (outcome === 'success') {
    const password = await getSecureItem(SecureKeys.rememberedPassword);
    if (password) {
      return { status: 'unlocked', credentials: { identifier: account.identifier, password } };
    }
    await forgetRememberedLogin();
    return {
      status: 'error',
      title: 'Escribe tu contraseña',
      message: 'No encontramos tus datos guardados en este celular. Entra con tu contraseña.',
      forgotten: true,
    };
  }

  if (outcome === 'cancelled') return { status: 'cancelled' };

  if (outcome === 'lockout') {
    return {
      status: 'error',
      title: 'Demasiados intentos',
      message: `El celular bloqueó ${label} por un rato. Desbloquéalo con tu PIN o entra con tu contraseña.`,
      forgotten: false,
    };
  }

  // Si el teléfono de verdad se quedó sin bloqueo, la contraseña guardada ya
  // no tiene quién la proteja: se borra. Si fue un fallo pasajero, se respeta.
  if (outcome === 'unavailable') {
    const support = await getDeviceAuthSupport();
    if (support.status === 'no-lock') {
      await forgetRememberedLogin();
      return {
        status: 'error',
        title: 'Tu celular no tiene bloqueo',
        message:
          'Borramos tus datos guardados porque el celular ya no tiene huella, PIN ni patrón. Entra con tu contraseña.',
        forgotten: true,
      };
    }
  }

  return {
    status: 'error',
    title: 'No pudimos confirmar que eres tú',
    message: 'Intenta de nuevo o entra con tu contraseña.',
    forgotten: false,
  };
};

/* ── Aviso automático al abrir ────────────────────────────────────────────── */

/**
 * El aviso de huella se lanza solo **una vez por arranque** y solo si la app
 * abrió sin sesión: es "abrir la app y entrar con el dedo". Después de un
 * cierre de sesión no se lanza: quien acaba de salir probablemente quiere
 * entrar con otra cuenta, y un aviso que aparece solo le estorbaría.
 */
let autoPromptPending = true;

/** `true` la primera vez que se consulta, si nadie lo canceló antes. */
export const takeAutoPrompt = (): boolean => {
  const pending = autoPromptPending;
  autoPromptPending = false;
  return pending;
};

/** Lo llama la sesión cuando arranca con sesión o cuando se inicia una. */
export const cancelAutoPrompt = (): void => {
  autoPromptPending = false;
};
