/**
 * Traducción de errores de axios al `AppError` de la aplicación.
 */
import axios from 'axios';

import { AppError, codeFromStatus, isAppError } from '@/core/errors/AppError';

/** Formas conocidas en las que el backend devuelve el detalle de un error. */
interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  errors?: Record<string, string | string[]>;
  statusCode?: number;
}

const firstString = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : undefined;
};

/** Aplana `{ errors: { email: ['ya existe'] } }` a `{ email: 'ya existe' }`. */
const parseFieldErrors = (
  errors: ApiErrorBody['errors'],
): Record<string, string> | undefined => {
  if (!errors) return undefined;
  const output: Record<string, string> = {};
  for (const [field, value] of Object.entries(errors)) {
    const message = firstString(value);
    if (message) output[field] = message;
  }
  return Object.keys(output).length > 0 ? output : undefined;
};

/**
 * Convierte cualquier error de red/HTTP en un `AppError` con mensaje listo
 * para mostrar. Respeta el mensaje del backend cuando viene y es legible.
 */
export const toHttpAppError = (error: unknown): AppError => {
  if (isAppError(error)) return error;

  if (axios.isCancel(error)) {
    return new AppError('CANCELLED', { cause: error });
  }

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new AppError('TIMEOUT', { cause: error });
    }

    // Sin `response` significa que la petición nunca llegó al servidor.
    if (!error.response) {
      return new AppError('NETWORK', { cause: error });
    }

    const status = error.response.status;
    const body = error.response.data as ApiErrorBody | undefined;
    const code = codeFromStatus(status);

    /**
     * El backend responde de dos formas distintas y solo una sirve para el
     * usuario: las reglas de negocio llegan como un string en español ("El
     * pago no puede ser mayor al saldo actual"), mientras que las validaciones
     * de `class-validator` llegan como un array de frases técnicas en inglés
     * ("amount must be a number conforming to..."). Esas se descartan a favor
     * del texto por defecto del código de error.
     */
    const backendMessage = Array.isArray(body?.message)
      ? undefined
      : (firstString(body?.message) ?? body?.error);

    return new AppError(code, {
      status,
      cause: error,
      fieldErrors: parseFieldErrors(body?.errors),
      // Para 5xx nunca mostramos el texto del servidor: suele ser un stack trace.
      message: code === 'SERVER' ? undefined : backendMessage,
      /**
       * El mismo texto, guardado aparte para los logs. Un 5xx se registraba
       * como `{ code: 'SERVER' }` a secas y no se podía saber si venía de la
       * API o del proxy; con esto el registro dice qué respondió de verdad.
       * Nest contesta JSON (`{"statusCode":500,...}`) y el proxy de Render
       * contesta HTML, así que el origen se distingue de un vistazo.
       */
      detail:
        backendMessage ??
        (typeof error.response.data === 'string'
          ? error.response.data.slice(0, 200)
          : undefined),
    });
  }

  return new AppError('UNKNOWN', { cause: error });
};
