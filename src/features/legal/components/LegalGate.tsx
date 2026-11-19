/**
 * Puerta de documentos legales para la app con sesión.
 *
 * Al entrar (login o sesión restaurada) pregunta al backend si el usuario
 * tiene documentos vigentes sin aceptar. Si los tiene, en lugar de la app se
 * muestra `LegalUpdateScreen` hasta que los acepte o cierre sesión.
 *
 * Decisiones:
 *  - **No bloquea mientras pregunta.** La app se pinta de inmediato y la
 *    puerta solo aparece si la respuesta trae pendientes: el backend gratuito
 *    puede tardar en despertar y no tiene sentido tener al tendero mirando un
 *    spinner por algo que casi nunca pasa.
 *  - **Sin red no bloquea.** Si la consulta falla, la app sigue funcionando;
 *    `useAsyncData` vuelve a preguntar cuando regresa la conexión.
 *  - Se consulta `GET /legal/pending` y no el `pendingLegalDocuments` del
 *    login: así funciona igual con una sesión restaurada al abrir la app, que
 *    no pasa por el login.
 *  - `useLegalGate().recheck()` vuelve a preguntar. Lo usa quien cambia lo que
 *    el usuario tiene que aceptar sin pasar por el login: hoy, aceptar la
 *    transferencia de un negocio, que le exige los documentos para dueños.
 */
import { type ReactNode, createContext, useContext, useMemo } from 'react';

import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useSession } from '@/features/auth/session/SessionProvider';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalUpdateScreen } from '@/features/legal/screens/LegalUpdateScreen';

interface LegalGateContextValue {
  /** Vuelve a consultar los pendientes; si hay, aparece la pantalla de aceptación. */
  recheck: () => Promise<void>;
}

const LegalGateContext = createContext<LegalGateContextValue>({
  recheck: async () => undefined,
});

export const useLegalGate = (): LegalGateContextValue => useContext(LegalGateContext);

export const LegalGate = ({ children }: { children: ReactNode }) => {
  const { user } = useSession();
  const pending = useAsyncData(legalApi.pending, {
    enabled: Boolean(user?.id),
    deps: [user?.id],
  });

  const value = useMemo<LegalGateContextValue>(
    () => ({ recheck: pending.refresh }),
    [pending.refresh],
  );

  if (pending.data?.length) {
    return <LegalUpdateScreen documents={pending.data} onDone={pending.setData} />;
  }

  return <LegalGateContext.Provider value={value}>{children}</LegalGateContext.Provider>;
};
