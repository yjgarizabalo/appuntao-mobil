/**
 * API del ciclo de vida de la cuenta propia.
 *
 *  - `POST /users/me/deactivate`: una pausa. Cierra todas las sesiones, no
 *    borra nada y sus negocios siguen funcionando para su equipo. Se vuelve
 *    iniciando sesión (ver `LoginScreen`).
 *  - `GET /users/me/deletion-preview`: qué pasará si la elimina (plazo de
 *    gracia y negocios de los que es dueño, con sus clientes y saldo).
 *  - `POST /users/me/deletion`: la solicita. La cuenta queda inactiva, el
 *    backend cierra todas las sesiones y la anonimiza al terminar el plazo.
 *    Hasta entonces se cancela iniciando sesión (ver `LoginScreen`).
 *
 * Las dos piden la contraseña o se basan en una sesión ya abierta: un teléfono
 * desbloqueado no basta para borrar la cuenta de otra persona.
 */
import { http } from '@/core/http/client';
import { mapDeletionPreview } from '@/domain/mappers';
import type { DeletionPreview } from '@/domain/models';

export interface DeletionRequest {
  password: string;
  /** Obligatorio si es dueño de negocios activos: confirma que se cerrarán. */
  acknowledgeBusinessClosure?: boolean;
}

export interface DeletionScheduled {
  message: string;
  /** ISO. Cuándo se eliminará definitivamente. */
  deletionScheduledAt: string;
}

export const accountApi = {
  deactivate: async (password: string): Promise<string> => {
    const { data } = await http.post('/users/me/deactivate', { password });
    return String(data?.message ?? '');
  },

  deletionPreview: async (): Promise<DeletionPreview> => {
    const { data } = await http.get('/users/me/deletion-preview');
    return mapDeletionPreview(data);
  },

  requestDeletion: async (request: DeletionRequest): Promise<DeletionScheduled> => {
    const { data } = await http.post('/users/me/deletion', request);
    return {
      message: String(data?.message ?? ''),
      deletionScheduledAt: String(data?.deletionScheduledAt ?? ''),
    };
  },
};
