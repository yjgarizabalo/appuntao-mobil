/**
 * Mapeo de las respuestas del backend a los modelos del dominio.
 *
 * Es la frontera del sistema: aquí —y solo aquí— se toleran las rarezas del
 * API (importes como string `"15000.00"`, campos que a veces no vienen,
 * nombres alternativos). A partir de este punto el resto de la app trabaja con
 * datos limpios y tipados, así que ninguna pantalla necesita `Number(x)` ni
 * `?? 0` defensivos.
 */
import { toAmount, toList } from '@/core/http/payload';
import {
  type BusinessRole,
  type DebtStatus,
  type DocumentType,
  type InvitationStatus,
  type InvitationType,
  type PaymentMethod,
  type TransactionType,
  isBusinessRole,
  isDocumentType,
} from './constants';
import {
  LEGAL_AUDIENCES,
  type LegalAudience,
  type LegalDocument,
  type LegalDocumentSummary,
} from './legal';
import type {
  Business,
  BusinessSummary,
  ClientAccount,
  Debt,
  Debtor,
  DeletionPreview,
  Invitation,
  InvitationShare,
  Member,
  OwnedBusinessSummary,
  OwnershipTransfer,
  OwnershipTransferStatus,
  Payment,
  TransferCandidate,
  User,
} from './models';

type Raw = Record<string, unknown>;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

const asBoolean = (value: unknown): boolean => value === true || value === 'true';

/** Texto no vacío, o `undefined` si no vino. */
const optionalString = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  const text = String(value);
  return text ? text : undefined;
};

const asDocumentType = (value: unknown): DocumentType => {
  const raw = asString(value).toUpperCase();
  // Datos viejos guardados antes de alinear el enum con el backend.
  if (raw === 'CE' || raw === 'PP' || raw === 'TI') return 'FOREIGNER';
  return isDocumentType(raw) ? raw : 'CC';
};

const asPaymentMethod = (value: unknown): PaymentMethod => {
  const raw = asString(value).toUpperCase();
  if (raw === 'TRANSFER') return 'TRANSFER';
  if (raw === 'OTHER' || raw === 'CARD') return 'OTHER';
  return 'CASH';
};

const asTransactionType = (value: unknown): TransactionType => {
  const raw = asString(value).toUpperCase();
  if (raw === 'ADJUSTMENT' || raw === 'REVERSAL') return raw;
  return 'PAYMENT';
};

const asDebtStatus = (value: unknown): DebtStatus => {
  const raw = asString(value).toUpperCase();
  if (raw === 'PAID' || raw === 'PARTIAL' || raw === 'CANCELLED') return raw;
  return 'OPEN';
};

const asBusinessRole = (value: unknown): BusinessRole => {
  const raw = asString(value).toUpperCase();
  // El rol más restrictivo es el respaldo seguro: ante un valor raro, que no
  // otorgue permisos de más.
  return isBusinessRole(raw) ? raw : 'VIEWER';
};

/** Lee el `id` de una relación anidada (`debtor: { id }`). */
const relationId = (value: unknown): string =>
  typeof value === 'object' && value !== null ? asString((value as Raw).id) : '';

/* ── Usuario ──────────────────────────────────────────────────────────────── */

export const mapUser = (raw: unknown): User => {
  const data = (raw ?? {}) as Raw;
  return {
    id: asString(data.id),
    email: asString(data.email),
    name: data.name === undefined ? undefined : asString(data.name),
    firstName: data.firstName === undefined ? undefined : asString(data.firstName),
    lastName: data.lastName === undefined ? undefined : asString(data.lastName),
    documentType: data.documentType === undefined ? undefined : asDocumentType(data.documentType),
    documentNumber:
      data.documentNumber === undefined ? undefined : asString(data.documentNumber),
    phone: data.phone === undefined ? undefined : asString(data.phone),
    role: data.role === undefined ? undefined : asString(data.role),
  };
};

/* ── Negocio ──────────────────────────────────────────────────────────────── */

/**
 * Una fila de `businessUsers` embebida en el negocio. El nombre a mostrar se
 * resuelve aquí (nombre completo, o correo de respaldo) para que ninguna
 * pantalla tenga que rearmarlo.
 */
export const mapMember = (raw: unknown): Member => {
  const data = (raw ?? {}) as Raw;
  const user = (data.user ?? {}) as Raw;
  const fullName = `${asString(user.firstName)} ${asString(user.lastName)}`.trim();

  return {
    id: asString(data.id),
    userId: asString(data.userId) || asString(user.id),
    role: asBusinessRole(data.role),
    name: fullName || asString(user.email, 'Sin nombre'),
    email: user.email === undefined ? undefined : asString(user.email),
    phone: user.phone === undefined ? undefined : asString(user.phone),
  };
};

export const mapBusiness = (raw: unknown): Business => {
  const data = (raw ?? {}) as Raw;
  // `GET /business` incluye `businessUsers`; el POST de creación no. Se deja en
  // `undefined` cuando no viene, para distinguir "sin lista" de "sin miembros".
  const members = Array.isArray(data.businessUsers)
    ? data.businessUsers.map(mapMember)
    : undefined;

  return {
    id: asString(data.id),
    name: asString(data.name, 'Sin nombre'),
    address: asString(data.address),
    currency: data.currency === undefined ? undefined : asString(data.currency),
    ownerId: data.ownerId === undefined ? undefined : asString(data.ownerId),
    members,
    createdAt: data.createdAt === undefined ? undefined : asString(data.createdAt),
  };
};

/* ── Invitación ───────────────────────────────────────────────────────────── */

const asInvitationStatus = (value: unknown): InvitationStatus => {
  const raw = asString(value).toUpperCase();
  if (
    raw === 'ACCEPTED' ||
    raw === 'REJECTED' ||
    raw === 'CANCELLED' ||
    raw === 'EXPIRED'
  ) {
    return raw;
  }
  return 'PENDING';
};

const asInvitationType = (value: unknown): InvitationType =>
  asString(value).toUpperCase() === 'BUSINESS_USER' ? 'BUSINESS_USER' : 'DEBTOR';

export const mapInvitation = (raw: unknown): Invitation => {
  const data = (raw ?? {}) as Raw;
  return {
    id: asString(data.id),
    code: asString(data.code),
    // La vista de la persona invitada trae el negocio anidado, sin `businessId`.
    businessId: asString(data.businessId) || relationId(data.business),
    businessName: optionalString((data.business as Raw | null | undefined)?.name),
    debtorId: optionalString(data.debtorId) ?? optionalString((data.debtor as Raw | null | undefined)?.id),
    debtorName: optionalString((data.debtor as Raw | null | undefined)?.name),
    invitedByName: data.createdBy ? personName(data.createdBy) || undefined : undefined,
    email: data.email == null ? undefined : asString(data.email),
    phone: data.phone == null ? undefined : asString(data.phone),
    // En las invitaciones de tipo DEBTOR el rol viene nulo: se respeta.
    role: data.role == null ? null : asBusinessRole(data.role),
    status: asInvitationStatus(data.status),
    type: asInvitationType(data.type),
    expiresAt: asString(data.expiresAt),
    createdAt: data.createdAt === undefined ? undefined : asString(data.createdAt),
  };
};

/* ── Cliente / deudor ─────────────────────────────────────────────────────── */

export const mapDebtor = (raw: unknown, businessId?: string): Debtor => {
  const data = (raw ?? {}) as Raw;

  /**
   * El saldo se deja en `undefined` cuando el backend no lo manda, y esa
   * distinción importa: convertirlo en `0` hacía que el detalle del cliente
   * mostrara "Al día" y deshabilitara el cobro aunque hubiera deudas
   * abiertas. El listado, el resumen y el detalle mandan `totalBalance`.
   */
  const balance = data.balance === undefined ? undefined : toAmount(data.balance);
  const totalBalance = data.totalBalance === undefined ? undefined : toAmount(data.totalBalance);

  return {
    id: asString(data.id),
    name: asString(data.name, 'Sin nombre'),
    documentType: asDocumentType(data.documentType),
    documentNumber: asString(data.documentNumber),
    phone: asString(data.phone),
    balance,
    totalBalance,
    // Si el backend no manda la bandera, se deduce del saldo.
    hasPendingDebt:
      data.hasPendingDebt === undefined
        ? (balance ?? 0) > 0 || (totalBalance ?? 0) > 0
        : asBoolean(data.hasPendingDebt),
    businessId: asString(data.businessId) || relationId(data.business) || businessId,
    isLinked: data.userId != null || data.user != null,
  };
};

/** `POST /invitations` y `POST /invitations/:id/resend`. */
export const mapInvitationShare = (raw: unknown): InvitationShare => {
  const data = (raw ?? {}) as Raw;
  return {
    invitation: mapInvitation(data.invitation ?? data),
    shareText: asString(data.shareText),
    whatsappUrl: optionalString(data.whatsappUrl) ?? null,
    emailSent: asBoolean(data.emailSent),
  };
};

/**
 * `GET /debtors/summary`. Los conteos vienen como números, pero pasan por
 * `toAmount` igual que los importes por si el driver los serializa como
 * string: es la frontera, y aquí se tolera esa rareza en vez de en la pantalla.
 */
export const mapBusinessSummary = (raw: unknown, businessId?: string): BusinessSummary => {
  const data = (raw ?? {}) as Raw;

  return {
    totalBalance: toAmount(data.totalBalance),
    totalDebtors: toAmount(data.totalDebtors),
    debtorsWithDebt: toAmount(data.debtorsWithDebt),
    debtorsClear: toAmount(data.debtorsClear),
    topDebtors: toList<unknown>(data.topDebtors).map((item) => mapDebtor(item, businessId)),
  };
};

/* ── Pago ─────────────────────────────────────────────────────────────────── */

export const mapPayment = (raw: unknown, debtId = ''): Payment => {
  const data = (raw ?? {}) as Raw;
  return {
    id: asString(data.id),
    debtId: asString(data.debtId, debtId),
    // El backend usa `appliedAmount` en los pagos de un grupo global.
    amount: toAmount(data.amount ?? data.appliedAmount),
    method: asPaymentMethod(data.method),
    type: asTransactionType(data.type),
    note: asString(data.note),
    createdAt: data.createdAt === undefined ? undefined : asString(data.createdAt),
    totalAmount: data.totalAmount === undefined ? undefined : toAmount(data.totalAmount),
  };
};

/* ── Deuda ────────────────────────────────────────────────────────────────── */

export const mapDebt = (raw: unknown, businessId = ''): Debt => {
  const data = (raw ?? {}) as Raw;
  const id = asString(data.id);
  const amount = toAmount(data.amount);
  const payments = Array.isArray(data.payments)
    ? data.payments.map((payment) => mapPayment(payment, id))
    : [];

  // `remainingAmount` y `balance` son dos nombres para lo mismo según el
  // endpoint; si no viene ninguno, se calcula con los pagos.
  const paid = payments.reduce((total, payment) => total + payment.amount, 0);
  const remainingRaw = data.remainingAmount ?? data.balance;
  const remainingAmount =
    remainingRaw === undefined ? Math.max(0, amount - paid) : toAmount(remainingRaw);

  return {
    id,
    // El listado de deudas no trae los ids sueltos: vienen anidados como
    // `business: { id }` y `debtor: { id }`.
    businessId: asString(data.businessId) || relationId(data.business) || businessId,
    debtorId: asString(data.debtorId) || relationId(data.debtor),
    amount,
    remainingAmount,
    description: asString(data.description),
    dueDate: asString(data.dueDate),
    status: asDebtStatus(data.status),
    createdAt: data.createdAt === undefined ? undefined : asString(data.createdAt),
    payments,
  };
};

/* ── El usuario como cliente ──────────────────────────────────────────────── */

/**
 * Una entrada de `clientBusinesses` de `GET /users/me/dashboard`.
 *
 * Ojo con los ids: el `id` de la raíz es el de la **ficha de deudor**, no el
 * del negocio; ese viene anidado en `business`. Confundirlos manda el
 * `debtorId` como `x-business-id` y el backend responde 404.
 */
export const mapClientAccount = (raw: unknown): ClientAccount => {
  const data = (raw ?? {}) as Raw;
  const business = (data.business ?? {}) as Raw;

  return {
    debtorId: asString(data.id),
    debtorName: asString(data.name, 'Tu cuenta'),
    businessId: asString(business.id),
    businessName: asString(business.name, 'Tienda'),
    phone: data.phone == null ? undefined : asString(data.phone),
  };
};

/* ── Documentos legales ───────────────────────────────────────────────────── */

/**
 * Resumen de un documento (`pendingLegalDocuments` del login). Los tipos no se
 * filtran: el catálogo es del backend, y descartar uno que la app no conoce
 * haría que se envíen menos aceptaciones de las que exige. Sin `title`, se
 * muestra el código antes que nada.
 */
export const mapLegalSummary = (raw: unknown): LegalDocumentSummary | null => {
  const data = (raw ?? {}) as Raw;
  const id = asString(data.id);
  const type = asString(data.type);
  if (!id || !type) return null;
  return { id, type, version: asString(data.version), title: asString(data.title) || type };
};

const LEGAL_AUDIENCE_VALUES: readonly string[] = Object.values(LEGAL_AUDIENCES);

/** Documento completo de `GET /legal/current` o `GET /legal/pending`. */
export const mapLegalDocument = (raw: unknown): LegalDocument | null => {
  const summary = mapLegalSummary(raw);
  if (!summary) return null;
  const data = raw as Raw;
  const audience = asString(data.audience);
  return {
    ...summary,
    audience: LEGAL_AUDIENCE_VALUES.includes(audience) ? (audience as LegalAudience) : null,
    // Ante la duda, obligatorio: pedir de más se corrige con un toque; de menos, no.
    required: data.required !== false,
    content: asString(data.content),
    contentHash: asString(data.contentHash),
    url: data.url == null ? null : asString(data.url),
    publishedAt: asString(data.publishedAt),
  };
};

/** Lista de documentos, sin los que no se pudieron interpretar. */
export const mapLegalDocuments = (payload: unknown): LegalDocument[] =>
  toList<unknown>(payload)
    .map(mapLegalDocument)
    .filter((doc): doc is LegalDocument => doc !== null);

/* ── Ciclo de vida de la cuenta y transferencias ──────────────────────────── */

const personName = (raw: unknown): string => {
  const data = (raw ?? {}) as Raw;
  return `${asString(data.firstName)} ${asString(data.lastName)}`.trim();
};

/** `GET /business/ownership-transfers/incoming`, `POST /business/:id/ownership-transfer`… */
const TRANSFER_STATUSES: readonly OwnershipTransferStatus[] = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

export const mapOwnershipTransfer = (raw: unknown): OwnershipTransfer | null => {
  const data = (raw ?? {}) as Raw;
  const id = asString(data.id);
  if (!id) return null;
  const business = (data.business ?? {}) as Raw;
  const fromUser = (data.fromUser ?? {}) as Raw;
  const toUser = (data.toUser ?? {}) as Raw;
  const status = asString(data.status);
  return {
    id,
    status: (TRANSFER_STATUSES as readonly string[]).includes(status)
      ? (status as OwnershipTransferStatus)
      : 'PENDING',
    businessId: asString(data.businessId) || asString(business.id),
    businessName: asString(business.name, 'Negocio'),
    fromUserId: asString(data.fromUserId) || asString(fromUser.id),
    fromName: personName(fromUser),
    toUserId: asString(data.toUserId) || asString(toUser.id),
    toName: personName(toUser),
    expiresAt: asString(data.expiresAt),
    respondedAt: data.respondedAt == null ? null : asString(data.respondedAt),
    createdAt: data.createdAt == null ? undefined : asString(data.createdAt),
  };
};

export const mapOwnershipTransfers = (payload: unknown): OwnershipTransfer[] =>
  toList<unknown>(payload)
    .map(mapOwnershipTransfer)
    .filter((transfer): transfer is OwnershipTransfer => transfer !== null);

const mapTransferCandidate = (raw: unknown): TransferCandidate => {
  const data = (raw ?? {}) as Raw;
  return {
    userId: asString(data.userId),
    name: personName(data) || 'Miembro',
    role: asBusinessRole(data.role),
  };
};

const mapOwnedBusinessSummary = (raw: unknown): OwnedBusinessSummary => {
  const data = (raw ?? {}) as Raw;
  const pending = data.pendingTransfer as Raw | null | undefined;
  return {
    id: asString(data.id),
    name: asString(data.name, 'Negocio'),
    debtorsCount: Number(data.debtorsCount) || 0,
    pendingBalance: toAmount(data.pendingBalance),
    transferCandidates: toList<unknown>(data.transferCandidates).map(mapTransferCandidate),
    pendingTransfer: pending
      ? {
          id: asString(pending.id),
          toUserId: asString(pending.toUserId),
          expiresAt: asString(pending.expiresAt),
        }
      : null,
    lastExportedAt: data.lastExportedAt == null ? null : asString(data.lastExportedAt),
  };
};

/** `GET /users/me/deletion-preview` */
export const mapDeletionPreview = (raw: unknown): DeletionPreview => {
  const data = (raw ?? {}) as Raw;
  return {
    gracePeriodDays: Number(data.gracePeriodDays) || 15,
    ownedBusinesses: toList<unknown>(data.ownedBusinesses).map(mapOwnedBusinessSummary),
  };
};
