/**
 * Vocabulario del negocio: tipos de documento, métodos de pago y estados.
 *
 * Estaban repartidos como strings sueltos por las pantallas del v1
 * (`'CC'` escrito a mano en dos formularios, `'CASH'` en el modal de pago).
 * Centralizarlos evita que un typo mande `"cash"` al backend y da las
 * etiquetas en español en un solo lugar.
 */

/* ── Tipos de documento ───────────────────────────────────────────────────── */

/**
 * Son los tres valores del enum `DocumentType` del backend. Ofrecer más
 * (pasaporte, tarjeta de identidad) hacía que el servidor rechazara el
 * registro con un 400, porque `@IsEnum` solo admite estos.
 */
export const DOCUMENT_TYPES = ['CC', 'FOREIGNER', 'NIT'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  CC: 'CC',
  FOREIGNER: 'CE',
  NIT: 'NIT',
};

export const DOCUMENT_TYPE_DESCRIPTION: Record<DocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  FOREIGNER: 'Cédula de extranjería',
  NIT: 'Número de identificación tributaria',
};

export const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABEL[value],
  description: DOCUMENT_TYPE_DESCRIPTION[value],
}));

export const isDocumentType = (value: string): value is DocumentType =>
  (DOCUMENT_TYPES as readonly string[]).includes(value);

/* ── Métodos de pago ──────────────────────────────────────────────────────── */

/** Enum `PaymentMethod` del backend. `CARD` no existe allí: un pago con
 *  tarjeta se registra como `OTHER`. */
export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export const PAYMENT_METHOD_ICON: Record<
  PaymentMethod,
  'cash-outline' | 'phone-portrait-outline' | 'ellipsis-horizontal-outline'
> = {
  CASH: 'cash-outline',
  TRANSFER: 'phone-portrait-outline',
  OTHER: 'ellipsis-horizontal-outline',
};

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

/* ── Estado de una deuda ──────────────────────────────────────────────────── */

export const DEBT_STATUSES = ['OPEN', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  OPEN: 'Pendiente',
  PARTIAL: 'Abonada',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

/* ── Tipo de movimiento ───────────────────────────────────────────────────── */

/**
 * `type` de un movimiento en el backend:
 * - `PAYMENT`: abono, plata que entregó el cliente; baja el saldo.
 * - `DISCOUNT`: descuento, lo que el negocio le perdona; baja el saldo sin
 *   que entre plata. Lo hacen dueño y administrador, con motivo.
 * - `REVERSAL`: reverso de un abono o un descuento; sube el saldo en lo mismo.
 *   Lo crea el backend al reversar; la app nunca lo manda como tipo.
 */
export const TRANSACTION_TYPES = ['PAYMENT', 'DISCOUNT', 'REVERSAL'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  PAYMENT: 'Abono',
  DISCOUNT: 'Descuento',
  REVERSAL: 'Reverso',
};

/* ── Rol dentro de un negocio ─────────────────────────────────────────────── */

/**
 * Enum `BusinessUserRole` del backend: el rol de una persona **dentro de un
 * negocio concreto**, guardado en la tabla de membresía `businessUser`. Es el
 * que gobierna la autorización (quién puede fiar, cobrar, editar, invitar).
 *
 * ⚠️ No confundir con `User.role` (el `role?: string` del modelo `User`), que
 * es el rol de plataforma (`USER`/`ADMIN`/`MODERATOR`/`SUSPENDED`) y que el
 * backend hoy **no** usa para autorizar nada. Este de aquí sí manda.
 *
 * Quien crea un negocio queda `OWNER`; los demás entran como `ADMIN`, `CASHIER`
 * o `VIEWER` por invitación.
 */
export const BUSINESS_ROLES = ['OWNER', 'ADMIN', 'CASHIER', 'VIEWER'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const BUSINESS_ROLE_LABEL: Record<BusinessRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  VIEWER: 'Solo lectura',
};

export const BUSINESS_ROLE_DESCRIPTION: Record<BusinessRole, string> = {
  OWNER: 'Control total del negocio y del equipo.',
  ADMIN: 'Registra y corrige clientes, deudas y pagos.',
  CASHIER: 'Fía y cobra en el día a día; no corrige clientes.',
  VIEWER: 'Solo consulta; no registra ni modifica nada.',
};

/**
 * Roles que se le pueden **asignar** a alguien al invitarlo. `OWNER` queda
 * fuera a propósito: el dueño es quien creó el negocio y no se reparte.
 */
export const ASSIGNABLE_BUSINESS_ROLES = ['ADMIN', 'CASHIER', 'VIEWER'] as const;
export type AssignableBusinessRole = (typeof ASSIGNABLE_BUSINESS_ROLES)[number];

export const ASSIGNABLE_BUSINESS_ROLE_OPTIONS = ASSIGNABLE_BUSINESS_ROLES.map((value) => ({
  value,
  label: BUSINESS_ROLE_LABEL[value],
  description: BUSINESS_ROLE_DESCRIPTION[value],
}));

export const isBusinessRole = (value: string): value is BusinessRole =>
  (BUSINESS_ROLES as readonly string[]).includes(value);

/* ── Invitaciones ─────────────────────────────────────────────────────────── */

/** Enum `InvitationType` del backend. La app de equipo solo crea `BUSINESS_USER`. */
export const INVITATION_TYPES = ['DEBTOR', 'BUSINESS_USER'] as const;
export type InvitationType = (typeof INVITATION_TYPES)[number];

/** Enum `InvitationStatus` del backend. */
export const INVITATION_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};
