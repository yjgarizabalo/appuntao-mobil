/**
 * Identidad de **la instalación**, no de la persona.
 *
 * El backend pasó a manejar una sesión por dispositivo: el login exige un
 * `deviceId` estable y el refresh lo usa para comprobar que el token se está
 * renovando desde donde se emitió. Sin esto, entrar en el celular cerraba la
 * sesión de la tablet y al revés.
 *
 * Tres decisiones que conviene no deshacer:
 *
 *  1. **Se genera una sola vez y no se borra al cerrar sesión.** La llave
 *     `device_id` sobrevive al `logout` a propósito: identifica el aparato,
 *     no al usuario. Si se regenerara en cada salida, el backend vería un
 *     dispositivo nuevo cada vez y acumularía sesiones fantasma.
 *  2. **Copia en memoria.** El interceptor de axios necesita el valor de
 *     forma síncrona para armar el header del refresh; leer AsyncStorage ahí
 *     obligaría a volver todo asíncrono, igual que pasa con los tokens.
 *  3. **No contiene nada personal.** Es un UUID aleatorio. El nombre del
 *     dispositivo se arma con marca, modelo y sistema operativo —nunca con
 *     el nombre que el usuario le puso al teléfono, que suele llevar su
 *     nombre real.
 */
import { randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { createLogger } from '@/core/logger';
import { StorageKeys, getItem, setItem } from '@/core/storage/storage';

const log = createLogger('device');

/** Tope que acepta el backend para `deviceName`. */
const MAX_DEVICE_NAME = 100;

let deviceId: string | null = null;

/**
 * Carga —o crea— el identificador de la instalación. Idempotente: solo toca
 * el disco la primera vez. Se llama al arrancar, junto con los tokens.
 */
export const hydrateDeviceId = async (): Promise<string> => {
  if (deviceId) return deviceId;

  const stored = await getItem(StorageKeys.deviceId);
  if (stored && stored.length >= 8) {
    deviceId = stored;
    return deviceId;
  }

  deviceId = randomUUID();
  await setItem(StorageKeys.deviceId, deviceId);
  log.info('Dispositivo registrado por primera vez');

  return deviceId;
};

/**
 * Identificador ya cargado, sin tocar el disco. `null` si todavía no se
 * hidrató: quien lo necesite sí o sí usa `hydrateDeviceId()`.
 */
export const getDeviceId = (): string | null => deviceId;

/**
 * Nombre legible del aparato para la futura pantalla de "sesiones activas"
 * del backend: `Samsung SM-A546E · Android 14`.
 *
 * `expo-device` devuelve `null` en los campos que no conoce (y casi todos en
 * web), así que se arma con lo que haya y se cae a `Platform` como último
 * recurso: es un dato informativo, nunca debe impedir un login.
 */
export const getDeviceName = (): string => {
  const brand = Device.brand?.trim();
  const model = Device.modelName?.trim();
  const osName = Device.osName?.trim() ?? Platform.OS;
  const osVersion = Device.osVersion?.trim() ?? String(Platform.Version);

  // "samsung" → "Samsung". Apple ya viene capitalizado y modelName no se toca.
  const hardware = [brand ? capitalize(brand) : undefined, model]
    .filter(Boolean)
    .join(' ');

  const system = [osName, osVersion].filter(Boolean).join(' ');
  const name = [hardware, system].filter((part) => part.length > 0).join(' · ');

  return (name.length > 0 ? name : Platform.OS).slice(0, MAX_DEVICE_NAME);
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
