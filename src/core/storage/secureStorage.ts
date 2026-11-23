/**
 * Almacenamiento cifrado para secretos: Keychain en iOS, Keystore en Android.
 *
 * AsyncStorage guarda en texto plano: sirve para preferencias y para los
 * tokens, que el backend puede revocar. Una contraseña no se revoca así —y la
 * gente la repite en otros sitios—, por eso va aquí y en ningún otro lado.
 *
 * Decisiones:
 *  - `WHEN_UNLOCKED_THIS_DEVICE_ONLY` en iOS: solo se lee con el teléfono
 *    desbloqueado y no viaja a iCloud ni a otro iPhone en un respaldo.
 *  - En Android, el plugin `expo-secure-store` de `app.json` saca estos datos
 *    del respaldo automático: la llave que los cifra no se respalda, y
 *    restaurarlos en otro teléfono solo daría basura.
 *  - En web no hay dónde guardarlos con garantías: todo responde "no
 *    disponible" y la función que dependa de esto simplemente no se ofrece.
 *  - Nunca lanza, igual que `storage.ts`: un fallo se registra (sin el valor)
 *    y se devuelve `null` o `false` para que quien llama decida qué decir.
 *
 * Las llaves son un juego cerrado, como `StorageKeys`. `SecureStore` solo
 * admite letras, números, `.`, `-` y `_` en el nombre.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createLogger } from '@/core/logger';

const log = createLogger('secure-storage');

export const SecureKeys = {
  /** Cuenta recordada para el ingreso rápido: id, identificador y nombre (JSON). */
  rememberedAccount: 'remembered_login_account',
  /** Contraseña de la cuenta recordada. */
  rememberedPassword: 'remembered_login_password',
} as const;

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const isWeb = Platform.OS === 'web';

/** `true` si el dispositivo puede guardar secretos cifrados. */
export const isSecureStorageAvailable = async (): Promise<boolean> => {
  if (isWeb) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch (error) {
    log.warn('No se pudo consultar el almacenamiento seguro', error);
    return false;
  }
};

/** Lee un secreto. `null` si no existe o si la lectura falla. */
export const getSecureItem = async (key: SecureKey): Promise<string | null> => {
  if (isWeb) return null;
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch (error) {
    log.error(`No se pudo leer "${key}"`, error);
    return null;
  }
};

/** Guarda un secreto. `false` si falla. */
export const setSecureItem = async (key: SecureKey, value: string): Promise<boolean> => {
  if (isWeb) return false;
  try {
    await SecureStore.setItemAsync(key, value, OPTIONS);
    return true;
  } catch (error) {
    log.error(`No se pudo guardar "${key}"`, error);
    return false;
  }
};

/** Borra uno o varios secretos. Borrar uno que no existe no es un error. */
export const removeSecureItems = async (keys: SecureKey[]): Promise<void> => {
  if (isWeb) return;
  await Promise.all(
    keys.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key, OPTIONS);
      } catch (error) {
        log.error(`No se pudo borrar "${key}"`, error);
      }
    }),
  );
};
