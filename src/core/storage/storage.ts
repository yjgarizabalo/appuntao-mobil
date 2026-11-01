/**
 * Capa de persistencia local sobre AsyncStorage.
 *
 * Las llaves están centralizadas y tipadas (en el v1 eran strings sueltos
 * repetidos en cinco archivos, con el riesgo de escribir mal una y perder la
 * sesión sin darse cuenta). Además todo está envuelto en try/catch: en un
 * dispositivo con el almacenamiento lleno, AsyncStorage lanza excepción y eso
 * no debe tumbar la app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '@/core/logger';

const log = createLogger('storage');

/** Llaves persistidas. Mantiene compatibilidad con las del v1. */
export const StorageKeys = {
  accessToken: 'auth_token',
  refreshToken: 'refresh_token',
  user: 'auth_user',
  /** Último negocio seleccionado, para no volver a preguntarlo al abrir la app. */
  activeBusinessId: 'active_business_id',
  /** Marca de que el usuario ya vio el onboarding. */
  onboardingSeen: 'onboarding_seen',
  /**
   * UUID de la instalación (`deviceId` del backend). A diferencia de las
   * demás llaves, **no se borra al cerrar sesión**: identifica el aparato,
   * no al usuario. Ver `@/core/device/deviceIdentity`.
   */
  deviceId: 'device_id',
  /**
   * Último modo usado (`tendero` o `cliente`). Se recuerda igual que el
   * negocio activo: quien entra a la app a mirar lo que debe espera abrirla
   * en esa vista, no en la de su tienda.
   */
  appMode: 'app_mode',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Lee un string. Devuelve `null` si no existe o si el storage falla. */
export const getItem = async (key: StorageKey): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    log.error(`No se pudo leer "${key}"`, error);
    return null;
  }
};

/** Escribe un string. Devuelve `false` si el storage falla. */
export const setItem = async (key: StorageKey, value: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    log.error(`No se pudo guardar "${key}"`, error);
    return false;
  }
};

/** Lee y parsea JSON. Devuelve `null` si no existe o si el JSON está corrupto. */
export const getJson = async <T>(key: StorageKey): Promise<T | null> => {
  const raw = await getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    log.warn(`JSON corrupto en "${key}", se descarta`, error);
    await removeItems([key]);
    return null;
  }
};

/** Serializa y escribe JSON. */
export const setJson = async <T>(key: StorageKey, value: T): Promise<boolean> =>
  setItem(key, JSON.stringify(value));

/** Borra una o varias llaves en una sola operación. */
export const removeItems = async (keys: StorageKey[]): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    log.error('No se pudieron borrar las llaves', { keys, error });
  }
};

/** Lee varias llaves de una vez (una sola llamada al puente nativo). */
export const getItems = async (
  keys: StorageKey[],
): Promise<Partial<Record<StorageKey, string | null>>> => {
  try {
    const entries = await AsyncStorage.multiGet(keys);
    return Object.fromEntries(entries) as Partial<Record<StorageKey, string | null>>;
  } catch (error) {
    log.error('No se pudieron leer las llaves', { keys, error });
    return {};
  }
};
