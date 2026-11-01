/**
 * Modelos del dominio.
 *
 * Un solo archivo con las entidades del negocio, en lugar de tenerlas
 * declaradas dentro de cada context como en el v1 (donde `Client` vivía en
 * `ClientContext` y había que importar el context solo para usar el tipo).
 *
 * Nota de nombres: el backend llama `debtor` al cliente que fía, y la interfaz
 * de usuario le dice "cliente". Aquí se respeta `Debtor` para que el código
 * hable el mismo idioma que el API, y la traducción a "cliente" ocurre solo en
 * los textos de pantalla.
 */
import type {
  BusinessRole,
  DebtStatus,
  DocumentType,
  InvitationStatus,
  InvitationType,
  PaymentMethod,
  TransactionType,
} from './constants';

/* ── Usuario ──────────────────────────────────────────────────────────────── */

export interface User {
  id: string;
  email: string;
  /** Nombre completo que devuelve el backend en el login. */
  name?: string;
  firstName?: string;
  lastName?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  phone?: string;
  role?: string;
}

/** Nombre para mostrar, con degradación elegante si faltan campos. */
export const displayName = (user: User | null): string => {
  if (!user) return 'Usuario';
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.firstName ?? user.name ?? user.email ?? 'Usuario';
};

/* ── Negocio ──────────────────────────────────────────────────────────────── */

export interface Business {
  id: string;
  name: string;
  address: string;
  currency?: string;
  /** Dueño del negocio (su `userId`). Lo devuelve el backend en el negocio. */
  ownerId?: string;
  /**
   * Miembros del negocio con su rol. `GET /business` los trae embebidos
   * (`businessUsers`), así que llegan sin pedir nada extra. Es opcional porque
   * algunos endpoints (p. ej. el POST de creación) devuelven el negocio pelado
   * sin la lista. Sirve para saber el rol propio (`roleInBusiness`) y, más
   * adelante, para la pantalla de equipo.
   */
  members?: Member[];
}

/** Una persona con acceso a un negocio y el rol que tiene en él. */
export interface Member {
  /** Id de la fila de membresía (`businessUser.id`), no el del usuario. */
  id: string;
  userId: string;
  role: BusinessRole;
  /** Nombre a mostrar, ya resuelto (nombre completo, o correo si falta). */
  name: string;
  email?: string;
  phone?: string;
}

/**
 * Invitación para sumar a alguien a un negocio. La app crea y consume solo las
 * de tipo `BUSINESS_USER`; las `DEBTOR` (vincular un cliente a su cuenta)
 * existen en el backend pero esta app no las genera.
 */
export interface Invitation {
  id: string;
  /** Código corto que el invitado teclea para aceptar. */
  code: string;
  /** Negocio al que pertenece la invitación. */
  businessId: string;
  email?: string;
  phone?: string;
  /** Rol que recibirá el invitado. `null` en las invitaciones de tipo DEBTOR. */
  role: BusinessRole | null;
  status: InvitationStatus;
  type: InvitationType;
  /** ISO date de expiración (7 días por defecto en el backend). */
  expiresAt: string;
  createdAt?: string;
}

export interface BusinessDraft {
  name: string;
  address: string;
}

/**
 * Rol del usuario dentro de un negocio, o `null` si no se puede determinar
 * (falta el negocio, el usuario, o el backend no incluyó los miembros). Ese
 * `null` es "desconocido", y `can()` lo trata de forma permisiva a propósito.
 */
export const roleInBusiness = (
  business: Business | null | undefined,
  userId: string | null | undefined,
): BusinessRole | null => {
  if (!business || !userId) return null;
  const membership = business.members?.find((member) => member.userId === userId);
  if (membership) return membership.role;
  // El dueño siempre debería estar en `members` como OWNER; el `ownerId` es un
  // respaldo por si el backend recortara la lista de miembros.
  if (business.ownerId && business.ownerId === userId) return 'OWNER';
  return null;
};

/* ── Cliente / deudor ─────────────────────────────────────────────────────── */

export interface Debtor {
  id: string;
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
  /**
   * Saldo pendiente en este negocio, cuando el backend lo manda. Es opcional a
   * propósito: `GET /debtors/:id` no devuelve saldo (la tabla no tiene esa
   * columna) y hay que distinguir "no vino" de "es cero".
   */
  balance?: number;
  /** Saldo consolidado en todos los negocios del usuario. */
  totalBalance?: number;
  hasPendingDebt?: boolean;
  /**
   * Negocio al que pertenece. El endpoint `/debtors/me/all` lo devuelve; el
   * de un negocio concreto no, y en ese caso se rellena en el cliente.
   */
  businessId?: string;
}

export interface DebtorDraft {
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
}

/** Saldo a mostrar: prioriza el del negocio y cae al consolidado. */
export const debtorBalance = (debtor: Debtor): number =>
  (debtor.balance ?? 0) > 0 ? (debtor.balance ?? 0) : (debtor.totalBalance ?? 0);

/**
 * Totales de un negocio, calculados por el servidor.
 *
 * Existen porque sumar en el móvil obligaba a descargar todos los clientes, y
 * el backend tope el `limit` en 100: pasando de 100 clientes el total que se
 * mostraba en el inicio era menor que el real y nada lo delataba.
 */
export interface BusinessSummary {
  /** Suma de todos los saldos pendientes del negocio. */
  totalBalance: number;
  /** Clientes activos del negocio. */
  totalDebtors: number;
  /** Clientes que deben algo. */
  debtorsWithDebt: number;
  /** Clientes al día. */
  debtorsClear: number;
  /** Los que más deben, ya ordenados de mayor a menor por el servidor. */
  topDebtors: Debtor[];
}

/* ── Deuda ────────────────────────────────────────────────────────────────── */

export interface Payment {
  id: string;
  debtId: string;
  amount: number;
  method: PaymentMethod;
  type: TransactionType;
  note: string;
  createdAt?: string;
  /** Presente en el resumen de un pago global: total repartido del grupo. */
  totalAmount?: number;
  /** Marca los resúmenes sintéticos creados en el cliente, no en el backend. */
  isGlobalSummary?: boolean;
}

export interface Debt {
  id: string;
  businessId: string;
  debtorId: string;
  amount: number;
  /** Lo que queda por pagar de esta deuda. */
  remainingAmount: number;
  description: string;
  dueDate: string;
  status: DebtStatus;
  createdAt?: string;
  /** El endpoint de deudas las devuelve con sus pagos embebidos. */
  payments: Payment[];
}

export interface DebtDraft {
  debtorId: string;
  amount: number;
  description: string;
  /** ISO date. Si no se envía, el backend usa su valor por defecto. */
  dueDate?: string;
}

export interface PaymentDraft {
  debtId: string;
  amount: number;
  method: PaymentMethod;
  note: string;
}

export interface GlobalPaymentDraft {
  debtorId: string;
  amount: number;
  method: PaymentMethod;
  note: string;
}

/* ── Movimiento (vista unificada del extracto) ────────────────────────────── */

/**
 * Una fila del extracto de un cliente. Es un tipo de la capa de presentación:
 * une deudas y pagos en una sola lista ordenada por fecha, que es como el
 * tendero lee la cuenta ("le fié, me abonó, le fié…").
 */
export type Movement =
  | { kind: 'debt'; id: string; date: number; amount: number; debt: Debt }
  | { kind: 'payment'; id: string; date: number; amount: number; payment: Payment };

/** Construye el extracto ordenado del más reciente al más antiguo. */
export const buildMovements = (debts: Debt[]): Movement[] => {
  const movements: Movement[] = [];

  for (const debt of debts) {
    movements.push({
      kind: 'debt',
      id: `debt-${debt.id}`,
      date: new Date(debt.createdAt ?? debt.dueDate).getTime(),
      amount: debt.amount,
      debt,
    });

    for (const payment of debt.payments) {
      movements.push({
        kind: 'payment',
        id: `payment-${payment.id}`,
        date: new Date(payment.createdAt ?? 0).getTime(),
        amount: payment.amount,
        payment,
      });
    }
  }

  return movements.sort((a, b) => b.date - a.date);
};

/* ── Agregados ────────────────────────────────────────────────────────────── */

export interface DebtorSummary {
  /** Suma de lo fiado. */
  totalDebt: number;
  /** Suma de lo abonado. */
  totalPaid: number;
  /** Lo que falta por cobrar. */
  balance: number;
  openDebts: number;
  paidDebts: number;
  /** Deuda vencida más antigua, si hay alguna. */
  oldestOverdueDate: string | null;
}

export const summarizeDebts = (debts: Debt[], serverBalance?: number): DebtorSummary => {
  let totalDebt = 0;
  let totalPaid = 0;
  let pending = 0;
  let openDebts = 0;
  let paidDebts = 0;
  let oldestOverdueDate: string | null = null;

  const today = Date.now();

  for (const debt of debts) {
    // Una deuda anulada no se le cobra a nadie: no suma ni al fiado ni al saldo.
    if (debt.status === 'CANCELLED') continue;

    totalDebt += debt.amount;
    // Solo los abonos cuentan como "pagado"; un ajuste o un reverso mueven el
    // saldo pero no son plata que el cliente entregó.
    for (const payment of debt.payments) {
      if (payment.type === 'PAYMENT') totalPaid += payment.amount;
    }

    if (debt.status === 'PAID') {
      paidDebts += 1;
      continue;
    }

    openDebts += 1;
    // `remainingAmount` es el `balance` que el backend calcula para cada deuda,
    // así que sumarlo da el saldo exacto sin depender de un total agregado.
    pending += debt.remainingAmount;

    const due = new Date(debt.dueDate).getTime();
    if (Number.isFinite(due) && due < today) {
      if (!oldestOverdueDate || due < new Date(oldestOverdueDate).getTime()) {
        oldestOverdueDate = debt.dueDate;
      }
    }
  }

  // Con deudas cargadas el saldo sale de ellas. `serverBalance` solo entra
  // cuando no hay ninguna (p. ej. una tarjeta de lista que aún no las pidió).
  const balance =
    debts.length > 0 ? Math.max(0, pending) : Math.max(0, serverBalance ?? 0);

  return { totalDebt, totalPaid, balance, openDebts, paidDebts, oldestOverdueDate };
};

/* ── El usuario visto como cliente ────────────────────────────────────────── */

/**
 * La ficha de deudor que **otro** tendero creó para este usuario en su negocio.
 *
 * Es la pieza que hace posible el modo cliente: la misma persona es `User`
 * cuando administra su tienda y `Debtor` cuando le fían en la tienda de al
 * lado. El backend las une con `Debtor.userId`, que se rellena solo cuando el
 * documento o el celular coinciden al registrarse, o cuando el usuario acepta
 * una invitación de tipo `DEBTOR`.
 *
 * El nombre no se toma de la cuenta sino de la ficha: el tendero pudo haberlo
 * anotado como "Don Pepe", y es así como aparece en su cuaderno.
 */
export interface ClientAccount {
  /** Id de la ficha de deudor. Es la llave para pedir las deudas. */
  debtorId: string;
  /** Nombre con el que el tendero lo registró. */
  debtorName: string;
  businessId: string;
  businessName: string;
  /** Teléfono anotado en la ficha, no el de la cuenta del usuario. */
  phone?: string;
}

/** Una cuenta de cliente con sus deudas y sus totales ya resueltos. */
export interface ClientStanding {
  account: ClientAccount;
  debts: Debt[];
  summary: DebtorSummary;
  /**
   * La carga de esta tienda falló. Se conserva la fila en vez de descartarla
   * para que el usuario vea *qué* tienda no cargó, en lugar de un total que
   * silenciosamente le queda corto.
   */
  failed?: boolean;
}

/** Consolidado de todas las tiendas donde al usuario le fían. */
export interface ClientOverview {
  /** Lo que debe sumando todas las tiendas. */
  totalBalance: number;
  /** Tiendas donde queda saldo pendiente. */
  storesWithDebt: number;
  /** Tiendas donde está vinculado, deba o no. */
  storesTotal: number;
  /** Vencimiento más antiguo sin pagar, entre todas las tiendas. */
  oldestOverdueDate: string | null;
  /** Alguna tienda no cargó: el total mostrado puede estar incompleto. */
  hasFailures: boolean;
}

/** Suma las cuentas del cliente en una sola cifra para el encabezado. */
export const summarizeStandings = (standings: ClientStanding[]): ClientOverview => {
  let totalBalance = 0;
  let storesWithDebt = 0;
  let oldestOverdueDate: string | null = null;
  let hasFailures = false;

  for (const standing of standings) {
    if (standing.failed) {
      hasFailures = true;
      continue;
    }

    totalBalance += standing.summary.balance;
    if (standing.summary.balance > 0) storesWithDebt += 1;

    const overdue = standing.summary.oldestOverdueDate;
    if (overdue) {
      if (!oldestOverdueDate || new Date(overdue).getTime() < new Date(oldestOverdueDate).getTime()) {
        oldestOverdueDate = overdue;
      }
    }
  }

  return {
    totalBalance,
    storesWithDebt,
    storesTotal: standings.length,
    oldestOverdueDate,
    hasFailures,
  };
};

/**
 * Una fila del extracto del cliente: el movimiento más la tienda donde pasó.
 *
 * `Movement` por sí solo no basta aquí: en modo tendero el extracto es de un
 * cliente dentro de *un* negocio, mientras que el cliente mira el de *todas*
 * las tiendas a la vez y necesita saber a cuál pertenece cada línea.
 */
export interface ClientMovement {
  movement: Movement;
  businessId: string;
  businessName: string;
}

/** Extracto unificado de todas las tiendas, del más reciente al más antiguo. */
export const buildClientMovements = (standings: ClientStanding[]): ClientMovement[] => {
  const rows: ClientMovement[] = [];

  for (const standing of standings) {
    if (standing.failed) continue;
    for (const movement of buildMovements(standing.debts)) {
      rows.push({
        movement,
        businessId: standing.account.businessId,
        businessName: standing.account.businessName,
      });
    }
  }

  return rows.sort((a, b) => b.movement.date - a.movement.date);
};
