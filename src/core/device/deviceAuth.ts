/**
 * Autenticación del dueño del teléfono: huella, rostro o, si no hay
 * biometría, el PIN, patrón o código del bloqueo de pantalla.
 *
 * Se acepta el bloqueo del teléfono como respaldo a propósito
 * (`disableDeviceFallback: false`): muchos celulares de gama baja no tienen
 * lector de huella, y lo que se quiere comprobar es que quien lo usa es su
 * dueño, no qué sensor tiene. En Android, si no hay biometría registrada, la
 * propia librería pide el PIN; en iOS lo hace el sistema.
 *
 * Este módulo solo habla con el sistema operativo. Qué se protege con esto y
 * qué hacer con cada resultado lo decide la feature que lo usa.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { createLogger } from '@/core/logger';

const log = createLogger('device-auth');

/** Lo que el teléfono le va a pedir a la persona. */
export type DeviceAuthKind = 'face' | 'fingerprint' | 'iris' | 'passcode';

export type DeviceAuthSupport =
  /** Tiene con qué comprobar que es su dueño. */
  | { status: 'available'; kind: DeviceAuthKind }
  /** El teléfono respondió que no tiene ningún bloqueo de pantalla. */
  | { status: 'no-lock' }
  /** Web, o no se pudo consultar: no se sabe, y no se ofrece. */
  | { status: 'unsupported' };

export type DeviceAuthOutcome =
  | 'success'
  /** La persona cerró el aviso o el sistema lo interrumpió. No es un error. */
  | 'cancelled'
  /** Demasiados intentos: el sistema bloqueó la biometría un rato. */
  | 'lockout'
  /** El teléfono ya no tiene bloqueo con el que comprobar nada. */
  | 'unavailable'
  | 'failed';

const { AuthenticationType, SecurityLevel } = LocalAuthentication;

/**
 * Qué puede usar este teléfono. En Android `supportedAuthenticationTypes`
 * dice qué sensores **hay**, no cuáles tienen datos registrados: si tiene
 * lector de huella se asume la huella, que es lo más común.
 */
export const getDeviceAuthSupport = async (): Promise<DeviceAuthSupport> => {
  if (Platform.OS === 'web') return { status: 'unsupported' };

  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === SecurityLevel.NONE) return { status: 'no-lock' };
    if (level === SecurityLevel.SECRET) return { status: 'available', kind: 'passcode' };

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const kind: DeviceAuthKind = types.includes(AuthenticationType.FINGERPRINT)
      ? 'fingerprint'
      : types.includes(AuthenticationType.FACIAL_RECOGNITION)
        ? 'face'
        : types.includes(AuthenticationType.IRIS)
          ? 'iris'
          : 'passcode';

    return { status: 'available', kind };
  } catch (error) {
    log.warn('No se pudo consultar la autenticación del dispositivo', error);
    return { status: 'unsupported' };
  }
};

/**
 * Nombre del método para armar frases: "Entrar con **tu huella**",
 * "Activa **Face ID**". En iOS se usan los nombres de Apple, que es como la
 * gente los conoce.
 */
export const deviceAuthLabel = (kind: DeviceAuthKind): string => {
  switch (kind) {
    case 'face':
      return Platform.OS === 'ios' ? 'Face ID' : 'tu rostro';
    case 'fingerprint':
      return Platform.OS === 'ios' ? 'Touch ID' : 'tu huella';
    case 'iris':
      return 'tu iris';
    case 'passcode':
      return 'el bloqueo del celular';
  }
};

/**
 * Pide al sistema que confirme que quien tiene el teléfono es su dueño.
 * `reason` es el texto que aparece en el aviso del sistema.
 */
export const authenticateOwner = async (reason: string): Promise<DeviceAuthOutcome> => {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // Los botones del aviso son del sistema; sin esto salen en inglés si la
      // app no declara el español como idioma en el `Info.plist`.
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar el código',
      disableDeviceFallback: false,
    });

    if (result.success) return 'success';

    switch (result.error) {
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
      case 'user_fallback':
        return 'cancelled';
      case 'lockout':
        return 'lockout';
      case 'not_enrolled':
      case 'passcode_not_set':
      case 'not_available':
        return 'unavailable';
      default:
        log.warn('La autenticación del dispositivo falló', { error: result.error });
        return 'failed';
    }
  } catch (error) {
    log.warn('La autenticación del dispositivo lanzó una excepción', error);
    return 'failed';
  }
};
