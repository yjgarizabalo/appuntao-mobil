/**
 * Estado del ingreso rápido para una pantalla: qué ofrece el teléfono y qué
 * cuenta está recordada.
 *
 * No es un provider: lo usan el login y el perfil, que nunca están montados a
 * la vez, y la fuente de verdad es el almacenamiento del teléfono. Cada
 * pantalla lo lee al montarse.
 *
 * Se vuelve a leer al regresar de segundo plano, porque es justo cuando la
 * persona pudo ir a los ajustes a ponerle (o quitarle) el bloqueo al celular.
 * Si se lo quitó, la contraseña guardada queda sin protección y se borra.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type DeviceAuthSupport, getDeviceAuthSupport } from '@/core/device/deviceAuth';
import {
  type RememberedAccount,
  forgetRememberedLogin,
  readRememberedAccount,
} from '@/features/auth/model/rememberedLogin';

export interface RememberedLoginState {
  /** `false` mientras se lee el teléfono: la pantalla espera para no parpadear. */
  isReady: boolean;
  support: DeviceAuthSupport;
  /** Cuenta recordada, solo si el teléfono todavía puede protegerla. */
  account: RememberedAccount | null;
  reload: () => Promise<void>;
  /** Borra los datos recordados. */
  forget: () => Promise<void>;
}

export const useRememberedLogin = (): RememberedLoginState => {
  const [isReady, setIsReady] = useState(false);
  const [support, setSupport] = useState<DeviceAuthSupport>({ status: 'unsupported' });
  const [account, setAccount] = useState<RememberedAccount | null>(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    const [nextSupport, nextAccount] = await Promise.all([
      getDeviceAuthSupport(),
      readRememberedAccount(),
    ]);

    let usable = nextAccount;
    if (nextAccount && nextSupport.status === 'no-lock') {
      await forgetRememberedLogin();
      usable = null;
    }

    if (!mountedRef.current) return;
    setSupport(nextSupport);
    // Con el soporte en duda (`unsupported`) no se borra nada, pero tampoco
    // se ofrece: no hay cómo pedir la autenticación.
    setAccount(nextSupport.status === 'available' ? usable : null);
    setIsReady(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [reload]);

  const forget = useCallback(async () => {
    await forgetRememberedLogin();
    if (mountedRef.current) setAccount(null);
  }, []);

  return { isReady, support, account, reload, forget };
};
