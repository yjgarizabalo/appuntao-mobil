/**
 * Validación de formularios, sin dependencias externas.
 *
 * Cada validador devuelve `undefined` cuando el valor es válido y un mensaje
 * en español cuando no lo es. Eso permite componerlos y alimentar
 * directamente el `error` de los inputs.
 */
import { digitsOnly } from './format';

export type Validator = (value: string) => string | undefined;

/** Mensaje de error por campo. */
export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ── Validadores individuales ─────────────────────────────────────────────── */

/**
 * Concuerda el adjetivo con el artículo de la etiqueta: "La contraseña es
 * obligatoria", no "es obligatorio". Las etiquetas de este proyecto siempre
 * empiezan por artículo ("El nombre", "La contraseña"), así que basta con
 * mirarlo.
 */
const agreesFeminine = (label: string) => /^(la|las)\s/i.test(label.trim());

export const required =
  (label = 'Este campo'): Validator =>
  (value) =>
    value.trim().length === 0
      ? `${label} es ${agreesFeminine(label) ? 'obligatoria' : 'obligatorio'}`
      : undefined;

export const email: Validator = (value) =>
  EMAIL_PATTERN.test(value.trim()) ? undefined : 'El correo no tiene un formato válido';

export const minLength =
  (length: number, label = 'Este campo'): Validator =>
  (value) =>
    value.trim().length < length
      ? `${label} debe tener al menos ${length} caracteres`
      : undefined;

/**
 * Número de documento, sin saber todavía el tipo: obligatorio y con forma de
 * documento (letras y números; puntos, espacios y guiones se ignoran). La
 * regla de cada tipo la aplica `documentNumberFor` al enviar, porque el tipo
 * es otro campo del formulario.
 */
export const documentNumber: Validator = (value) => {
  const compact = value.replace(/[\s.-]/g, '');
  if (compact.length === 0) return 'El número de documento es obligatorio';
  if (!/^[a-zA-Z0-9]+$/.test(compact)) return 'El documento solo puede tener letras y números';
  return undefined;
};

/**
 * Las mismas reglas por tipo que el backend (`IsDocumentNumber`), para que el
 * error salga junto al campo y no como un "datos inválidos" genérico:
 *
 *  - cédula: 6 a 10 dígitos;
 *  - NIT: 9 dígitos, o 10 con el de verificación;
 *  - extranjería: 3 a 20 letras o números.
 */
export const documentNumberFor =
  (documentType: string): Validator =>
  (value) => {
    const base = documentNumber(value);
    if (base) return base;
    if (documentType === 'CC') {
      const digits = digitsOnly(value);
      if (digits !== value.replace(/[\s.-]/g, '')) return 'La cédula solo lleva números';
      return digits.length >= 6 && digits.length <= 10
        ? undefined
        : 'La cédula debe tener entre 6 y 10 dígitos';
    }
    if (documentType === 'NIT') {
      const digits = digitsOnly(value);
      if (digits !== value.replace(/[\s.-]/g, '')) return 'El NIT solo lleva números';
      return digits.length === 9 || digits.length === 10
        ? undefined
        : 'El NIT debe tener 9 dígitos, o 10 con el dígito de verificación';
    }
    const compact = value.replace(/[\s.-]/g, '');
    return compact.length >= 3 && compact.length <= 20
      ? undefined
      : 'El documento de extranjería debe tener entre 3 y 20 letras o números';
  };

/**
 * Nombre o apellido: letras (con tildes y ñ), espacios, apóstrofo, punto y
 * guion, como el backend. Rangos explícitos en vez de `\p{L}`, que Hermes
 * no garantiza en todas las versiones.
 */
export const personName: Validator = (value) =>
  value.trim() && !/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'.-]*$/.test(value.trim())
    ? 'Solo letras, espacios, apóstrofos, puntos y guiones'
    : undefined;

/** Celular colombiano: 10 dígitos que empiezan por 3. */
export const phone: Validator = (value) => {
  const digits = digitsOnly(value);
  if (digits.length === 0) return 'El teléfono es obligatorio';
  if (digits.length !== 10) return 'El celular debe tener 10 dígitos';
  if (!digits.startsWith('3')) return 'El celular debe empezar por 3';
  return undefined;
};

/**
 * Contraseña. Se pide una longitud razonable y algo de variedad, sin llegar a
 * ser hostil: la meta es que el tendero pueda entrar, no aprobar una auditoría.
 */
export const password: Validator = (value) => {
  if (value.length === 0) return 'La contraseña es obligatoria';
  if (value.length < 8) return 'Debe tener al menos 8 caracteres';
  if (!/[a-zA-Z]/.test(value)) return 'Debe incluir al menos una letra';
  if (!/\d/.test(value)) return 'Debe incluir al menos un número';
  return undefined;
};

export const matches =
  (other: string, message = 'Los valores no coinciden'): Validator =>
  (value) =>
    value === other ? undefined : message;

/**
 * Identificador del login: correo, celular **o** número de documento. El
 * backend resuelve los tres contra la misma cuenta, así que aquí solo se
 * comprueba que tenga una forma plausible.
 */
export const emailOrDocument: Validator = (value) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Ingresa tu correo, celular o documento';
  const looksLikeEmail = trimmed.includes('@');
  if (looksLikeEmail) return email(trimmed);
  // Como lo normaliza el backend: "300 123 4567", "+57 300…" o "1.032.876.361"
  // valen, y el documento de extranjería puede llevar letras.
  const compact = trimmed.replace(/[\s.\-()+]/g, '');
  return /^[a-zA-Z0-9]{3,20}$/.test(compact)
    ? undefined
    : 'Ingresa un correo válido, un celular o un número de documento';
};

export const positiveAmount =
  (max?: number): Validator =>
  (value) => {
    const amount = Number(digitsOnly(value));
    if (!Number.isFinite(amount) || amount <= 0) return 'Ingresa un monto mayor a cero';
    if (max !== undefined && amount > max) return 'El monto supera el saldo pendiente';
    return undefined;
  };

/* ── Composición ──────────────────────────────────────────────────────────── */

/** Aplica validadores en orden y devuelve el primer error encontrado. */
export const validate = (value: string, ...validators: Validator[]): string | undefined => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return undefined;
};

/**
 * Valida un objeto completo contra un mapa de validadores.
 *
 * @example
 * const errors = validateFields(form, {
 *   name: [required('El nombre')],
 *   phone: [phone],
 * });
 */
export const validateFields = <T extends Record<string, string>>(
  values: T,
  rules: Partial<Record<keyof T, Validator[]>>,
): FieldErrors<Extract<keyof T, string>> => {
  const errors: Record<string, string> = {};
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const validators = rules[key];
    if (!validators) continue;
    const error = validate(values[key] ?? '', ...validators);
    if (error) errors[key as string] = error;
  }
  return errors as FieldErrors<Extract<keyof T, string>>;
};

/** `true` si no hay ningún error. */
export const isValid = (errors: FieldErrors): boolean => Object.keys(errors).length === 0;
