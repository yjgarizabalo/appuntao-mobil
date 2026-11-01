/**
 * API del modo cliente: lo que el usuario debe en las tiendas de otros.
 *
 * Es la cara opuesta de `debtorApi`. Allí el tendero consulta a *sus*
 * clientes; aquí el usuario consulta las fichas de deudor que **otros**
 * tenderos abrieron a su nombre. El vínculo lo guarda el backend en
 * `Debtor.userId` y se crea solo de dos maneras: al registrarse con el mismo
 * documento o celular que el tendero anotó, o al aceptar una invitación de
 * tipo `DEBTOR`.
 *
 * Se arma con dos endpoints que ya existen, sin tocar el backend:
 *
 *  1. `GET /users/me/dashboard` → `clientBusinesses`, la lista de tiendas
 *     donde le fían. No trae saldos, solo el vínculo.
 *  2. `GET /debtors/:debtorId/debts` (con `x-business-id`) → las deudas de esa
 *     ficha, con sus pagos embebidos. Una llamada por tienda.
 *
 * ⚠️ Deuda técnica conocida: el segundo endpoint solo valida que el negocio
 * exista y esté activo —no comprueba que quien pregunta sea el dueño de la
 * ficha ni miembro del negocio—, así que hoy funciona para el cliente por un
 * guard que falta, no por diseño. Esta capa **siempre** pide con el `debtorId`
 * que vino del dashboard del propio usuario, nunca con uno de otra procedencia,
 * para no apoyarse en ese hueco. Cuando el backend exponga endpoints propios
 * del cliente (`/me/...`) solo cambia este archivo.
 *
 * Tampoco hay un total consolidado en el servidor: se calcula aquí con
 * `summarizeDebts`, que es la misma función que usa el detalle del cliente en
 * modo tendero, así que las dos vistas no pueden discrepar.
 */
import { businessHeader, http } from '@/core/http/client';
import { toItem, toList } from '@/core/http/payload';
import { createLogger } from '@/core/logger';
import { mapClientAccount, mapDebt } from '@/domain/mappers';
import { type ClientAccount, type ClientStanding, summarizeDebts } from '@/domain/models';

const log = createLogger('client-api');

type Raw = Record<string, unknown>;

/**
 * Petición de vínculos en vuelo, compartida (patrón single-flight, el mismo
 * que usa la renovación de sesión en `core/http/client.ts`).
 *
 * Al montar el inicio del modo cliente salían **dos** peticiones simultáneas
 * a `/users/me/dashboard`: la del `useAsyncData` de la pantalla y la que el
 * efecto de foco dispara para refrescar los vínculos del interruptor. Cambiar
 * de modo remonta la pantalla, así que ir y volver multiplicaba las llamadas
 * sobre el endpoint más pesado del backend —hace tres consultas en paralelo—
 * corriendo en un plan gratuito. Ahora quien llega mientras hay una en curso
 * se cuelga de ella.
 */
let accountsInFlight: Promise<ClientAccount[]> | null = null;

const fetchAccounts = async (): Promise<ClientAccount[]> => {
  const { data } = await http.get('/users/me/dashboard');
  const dashboard = (toItem<Raw>(data) ?? {}) as Raw;

  return toList<unknown>(dashboard.clientBusinesses)
    .map(mapClientAccount)
    .filter((account) => account.businessId !== '' && account.debtorId !== '');
};

export const clientApi = {
  /**
   * `GET /users/me/dashboard` — tiendas donde al usuario le fían.
   *
   * El endpoint devuelve además los negocios propios y aquellos donde trabaja;
   * de eso ya se encarga `BusinessProvider`, así que aquí solo se lee la parte
   * de cliente. Las entradas sin `businessId` se descartan: sin negocio no se
   * puede consultar nada y una tarjeta rota confunde más que no mostrarla.
   */
  listAccounts: (): Promise<ClientAccount[]> => {
    accountsInFlight ??= fetchAccounts().finally(() => {
      accountsInFlight = null;
    });
    return accountsInFlight;
  },

  /**
   * `GET /debtors/:debtorId/debts` — las deudas del usuario en **una** tienda,
   * ya resumidas.
   *
   * Se pide con el `debtorId` que entregó el dashboard, nunca con uno armado
   * en la pantalla: ver la nota de autorización del encabezado.
   */
  getStanding: async (account: ClientAccount): Promise<ClientStanding> => {
    const { data } = await http.get(
      `/debtors/${account.debtorId}/debts`,
      businessHeader(account.businessId),
    );

    const debts = toList<unknown>(data).map((item) => mapDebt(item, account.businessId));

    return { account, debts, summary: summarizeDebts(debts) };
  },

  /**
   * Todas las cuentas del usuario, cargadas en paralelo.
   *
   * Se usa `allSettled` y no `all` a propósito: si la tienda de la esquina
   * responde con error, el usuario debe seguir viendo lo que debe en las otras
   * dos. La que falló queda marcada con `failed` y la pantalla lo dice, en vez
   * de mostrar un total silenciosamente incompleto.
   */
  loadStandings: async (accounts: ClientAccount[]): Promise<ClientStanding[]> => {
    const results = await Promise.allSettled(
      accounts.map((account) => clientApi.getStanding(account)),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;

      // `noUncheckedIndexedAccess`: el índice viene del mismo `map`, pero el
      // tipo no lo sabe. Si faltara, se omite la fila con un registro.
      const account = accounts[index];
      log.warn('No se pudieron cargar las deudas de una tienda', {
        businessId: account?.businessId,
      });

      return {
        account: account ?? {
          debtorId: '',
          debtorName: 'Tu cuenta',
          businessId: '',
          businessName: 'Tienda',
        },
        debts: [],
        summary: summarizeDebts([]),
        failed: true,
      };
    });
  },

  /** Cuentas + deudas en un solo paso: lo que necesita la pantalla de inicio. */
  loadOverview: async (): Promise<ClientStanding[]> => {
    const accounts = await clientApi.listAccounts();
    if (accounts.length === 0) return [];
    return clientApi.loadStandings(accounts);
  },
};
