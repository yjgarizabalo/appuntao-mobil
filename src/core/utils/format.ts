/**
 * Formateo de dinero, fechas, nombres y teléfonos.
 *
 * En el v1 `formatCurrency`, `getInitials`, `getAvatarColor` y `normalizeText`
 * estaban copiadas en cuatro archivos. Aquí viven una sola vez.
 */
import { palette } from '@/theme/tokens';

const LOCALE = 'es-CO';
const CURRENCY = 'COP';

/**
 * `Intl.NumberFormat` es costoso de construir, así que se crean una vez y se
 * reutilizan. En listas largas esto se nota.
 */
const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const plainNumberFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

/** `15000` → `"$ 15.000"` */
export const formatMoney = (value: number): string =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

/** `15000` → `"15.000"` (sin símbolo, para inputs). */
export const formatNumber = (value: number): string =>
  plainNumberFormatter.format(Number.isFinite(value) ? value : 0);

/** `1500000` → `"1,5 M"`. Para tarjetas de resumen donde el espacio manda. */
export const formatMoneyCompact = (value: number): string => {
  if (Math.abs(value) < 100_000) return formatMoney(value);
  return `$ ${compactFormatter.format(value)}`;
};

/** Deja solo dígitos: para parsear lo que el usuario escribe en un monto. */
export const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

/** `"$ 15.000"` → `15000` */
export const parseMoney = (value: string): number => {
  const digits = digitsOnly(value);
  return digits.length === 0 ? 0 : Number(digits);
};

/* ── Fechas ───────────────────────────────────────────────────────────────── */

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const parseDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `"2026-01-15"` → `"15 ene 2026"`. Cadena vacía si la fecha no es válida. */
export const formatDate = (value: string | number | Date | null | undefined): string => {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : '';
};

/** `"2026-01-15T10:30"` → `"15 ene, 10:30"` */
export const formatDateTime = (
  value: string | number | Date | null | undefined,
): string => {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : '';
};

/**
 * Fecha en lenguaje natural: `"Hoy"`, `"Ayer"`, `"Hace 3 días"`, y a partir de
 * una semana la fecha corta. Es lo que hace que un extracto se sienta humano.
 */
export const formatRelativeDate = (
  value: string | number | Date | null | undefined,
): string => {
  const date = parseDate(value);
  if (!date) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days > 1 && days < 7) return `Hace ${days} días`;
  if (days === -1) return 'Mañana';
  if (days < -1 && days > -7) return `En ${Math.abs(days)} días`;
  return formatDate(date);
};

/** Días de diferencia respecto a hoy. Negativo = ya venció. */
export const daysUntil = (value: string | number | Date | null | undefined): number | null => {
  const date = parseDate(value);
  if (!date) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
};

/* ── Texto ────────────────────────────────────────────────────────────────── */

/** Minúsculas y sin tildes: permite buscar "jose" y encontrar "José". */
export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** `"María José Pérez"` → `"MJ"` */
export const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
};

/** Primer nombre, para saludos: `"María José Pérez"` → `"María"` */
export const getFirstName = (name: string | undefined | null): string => {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] ?? '';
};

/** Recorta con puntos suspensivos sin cortar a mitad de palabra. */
export const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
};

/** `"3001234567"` → `"300 123 4567"` (formato colombiano de celular). */
export const formatPhone = (value: string): string => {
  const digits = digitsOnly(value);
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

/* ── Avatares ─────────────────────────────────────────────────────────────── */

/** Los colores viven en el tema (`palette.avatar`); aquí solo se elige uno. */
const AVATAR_COLORS = palette.avatar;

/** Color estable por nombre: el mismo cliente siempre tiene el mismo color. */
export const getAvatarColor = (name: string): string => {
  if (name.length === 0) return AVATAR_COLORS[0];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 2_147_483_647;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
};

/** Pluraliza sin repetir ternarios por toda la UI. */
export const pluralize = (count: number, singular: string, plural?: string): string =>
  `${formatNumber(count)} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
