/**
 * Modelo único de error de la aplicación.
 *
 * El v1 tenía tres clases equivalentes (`AuthError`, `UserServiceError`,
 * `RegisterError`) y cada pantalla repetía un `switch` para traducir el error
 * a un mensaje. Aquí hay **un** tipo de error con un código cerrado y su
 * mensaje para el usuario ya resuelto, así que las pantallas solo hacen
 * `showError(error)`.
 */

export type ErrorCode =
  | 'NETWORK' // sin conexión o el servidor no responde
  | 'TIMEOUT' // la petición tardó más que el timeout configurado
  | 'UNAUTHORIZED' // 401 — credenciales inválidas o sesión expirada
  | 'FORBIDDEN' // 403 — sin permisos sobre el recurso
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 — p. ej. el usuario ya existe
  | 'VALIDATION' // 400/422 — datos inválidos
  | 'RATE_LIMITED' // 429 — demasiados intentos seguidos
  | 'SERVER' // 5xx
  | 'CANCELLED' // la petición se abortó a propósito
  | 'UNKNOWN';

interface AppErrorOptions {
  /** Mensaje para el usuario. Si no se pasa, se usa el del código. */
  message?: string;
  /** Título para diálogos y toasts. */
  title?: string;
  /** Código HTTP original, si vino de una respuesta. */
  status?: number;
  /** Error subyacente, para depurar. */
  cause?: unknown;
  /** Errores por campo, cuando el backend los devuelve. */
  fieldErrors?: Record<string, string>;
  /**
   * Texto crudo del servidor, **solo para los logs**. Nunca se muestra al
   * usuario: en un 5xx suele ser un stack trace, y por eso `message` se queda
   * con la copia genérica. Existe porque sin él un 5xx se registraba como
   * `{ code: 'SERVER' }` a secas, que no permite distinguir un 500 de la API
   * de un 502 del proxy mientras el servicio despierta.
   */
  detail?: string;
}

/** Mensajes por defecto, en español, listos para mostrar al usuario. */
const DEFAULT_COPY: Record<ErrorCode, { title: string; message: string }> = {
  NETWORK: {
    title: 'Sin conexión',
    message:
      'No pudimos conectarnos al servidor. Revisa tu internet e inténtalo de nuevo.',
  },
  TIMEOUT: {
    title: 'El servidor tardó demasiado',
    message: 'La conexión está lenta. Inténtalo de nuevo en un momento.',
  },
  UNAUTHORIZED: {
    title: 'Sesión no válida',
    message: 'Tus datos de acceso no coinciden o tu sesión expiró.',
  },
  FORBIDDEN: {
    title: 'Sin permisos',
    message: 'No tienes permiso para hacer esta acción.',
  },
  NOT_FOUND: {
    title: 'No encontrado',
    message: 'No encontramos lo que buscabas. Puede que se haya eliminado.',
  },
  CONFLICT: {
    title: 'Ya existe',
    message: 'Ya hay un registro con esos datos.',
  },
  VALIDATION: {
    title: 'Revisa los datos',
    message: 'Algunos datos no son válidos. Corrígelos e inténtalo de nuevo.',
  },
  /**
   * El backend limita los intentos de inicio de sesión (5 por minuto). No es
   * un error del usuario ni algo que se deba reintentar solo: se le dice
   * cuánto esperar y se le deja decidir.
   */
  RATE_LIMITED: {
    title: 'Demasiados intentos',
    message: 'Espera un minuto antes de volver a intentarlo.',
  },
  SERVER: {
    title: 'Problema del servidor',
    message:
      'Estamos teniendo problemas técnicos. Inténtalo de nuevo en unos minutos.',
  },
  CANCELLED: {
    title: 'Operación cancelada',
    message: 'La operación se canceló.',
  },
  UNKNOWN: {
    title: 'Algo salió mal',
    message: 'Ocurrió un error inesperado. Si sigue pasando, escríbenos.',
  },
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly title: string;
  readonly status?: number;
  readonly fieldErrors?: Record<string, string>;
  /** Diagnóstico para logs. Ver `AppErrorOptions.detail`. */
  readonly detail?: string;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const copy = DEFAULT_COPY[code];
    super(options.message ?? copy.message);
    this.name = 'AppError';
    this.code = code;
    this.title = options.title ?? copy.title;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.detail = options.detail;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  /** `true` si reintentar la misma operación tiene sentido. */
  get isRetryable(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.code === 'SERVER';
  }

  /** `true` si el error obliga a cerrar la sesión. */
  get isSessionExpired(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  /**
   * Resumen para el logger: código, estado HTTP y texto del servidor. Es lo
   * que hay que pasar a `log.warn`/`log.error` en vez de armarlo a mano en
   * cada sitio, para que todos los registros tengan la misma forma.
   */
  get logContext(): { code: ErrorCode; status?: number; detail?: string } {
    return { code: this.code, status: this.status, detail: this.detail };
  }
}

/** Type guard para distinguir un AppError de cualquier otro throw. */
export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

/**
 * Convierte cualquier valor lanzado en un `AppError`.
 * Úsalo en los `catch` para no tener que comprobar el tipo en cada pantalla.
 */
export const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError('UNKNOWN', { cause: error });
  }
  return new AppError('UNKNOWN', { cause: error });
};

/** Traduce un código HTTP al código de error de la app. */
export const codeFromStatus = (status: number): ErrorCode => {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
};
