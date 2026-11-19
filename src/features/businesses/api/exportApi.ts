/**
 * Descargar la información de un negocio en Excel.
 *
 * `GET /business/:id/export` devuelve un `.xlsx` con las hojas Resumen,
 * Clientes, Deudas y Pagos. Solo lo puede pedir el dueño, y funciona también
 * con el negocio cerrado. Cada descarga queda en la auditoría del backend, que
 * por eso puede decir en `deletion-preview` cuándo fue la última.
 *
 * Se pide con el cliente `http` de siempre, no con la descarga nativa de
 * `expo-file-system`: así hereda la renovación de la sesión, el aviso de "sin
 * conexión" y los errores ya convertidos en `AppError`. El archivo se guarda
 * en la caché (el sistema la limpia solo) y se abre la hoja de compartir del
 * teléfono, desde donde el tendero lo guarda en Archivos o Drive, o lo manda
 * por WhatsApp o correo. En web, el navegador lo descarga directamente.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { AppError, toAppError } from '@/core/errors/AppError';
import { http } from '@/core/http/client';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Identificador de tipo que pide iOS para ofrecer las apps que abren Excel. */
const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet';

/** Saca el nombre de `attachment; filename="appuntao-tienda-2026-11-19.xlsx"`. */
const filenameFrom = (header: unknown): string => {
  const match = typeof header === 'string' ? /filename="?([^";]+)"?/i.exec(header) : null;
  // Solo letras, números, guiones y puntos: el nombre termina en una ruta.
  const clean = match?.[1]?.replace(/[^\w.-]+/g, '-');
  return clean && clean.toLowerCase().endsWith('.xlsx') ? clean : 'appuntao-negocio.xlsx';
};

/**
 * El cuerpo de la respuesta es binario, así que el mensaje del backend no se
 * puede leer en un error. Para los casos esperables se pone uno propio.
 */
const exportError = (caught: unknown): AppError => {
  const error = toAppError(caught);
  if (error.code === 'FORBIDDEN') {
    return new AppError('FORBIDDEN', {
      status: error.status,
      cause: caught,
      message: 'Solo el dueño puede descargar la información de este negocio.',
    });
  }
  if (error.code === 'NOT_FOUND') {
    return new AppError('NOT_FOUND', {
      status: error.status,
      cause: caught,
      message: 'Este negocio ya no existe o su información ya se eliminó.',
    });
  }
  return error;
};

/** Solo web: descarga el archivo con un enlace `blob:` que se libera al terminar. */
const downloadInBrowser = (content: ArrayBuffer, filename: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportApi = {
  /**
   * Descarga el Excel y abre la hoja de compartir.
   *
   * Si el teléfono no tiene hoja de compartir (algunos emuladores), lanza un
   * error con un mensaje claro en vez de dejar el archivo perdido en la caché.
   */
  downloadAndShare: async (businessId: string): Promise<void> => {
    const isWeb = Platform.OS === 'web';
    if (!isWeb && !(await Sharing.isAvailableAsync())) {
      throw new AppError('UNKNOWN', {
        title: 'No se puede compartir',
        message: 'Este dispositivo no permite guardar ni compartir archivos desde la app.',
      });
    }

    let content: ArrayBuffer;
    let filename: string;
    try {
      const response = await http.get<ArrayBuffer>(`/business/${businessId}/export`, {
        responseType: 'arraybuffer',
        headers: { Accept: XLSX_MIME },
      });
      content = response.data;
      filename = filenameFrom(response.headers['content-disposition']);
    } catch (caught) {
      throw exportError(caught);
    }

    // En el navegador `expo-file-system` no escribe archivos: se descarga
    // como cualquier archivo web, con un enlace temporal.
    if (isWeb) {
      downloadInBrowser(content, filename);
      return;
    }

    const bytes = new Uint8Array(content);

    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);

    await Sharing.shareAsync(file.uri, {
      mimeType: XLSX_MIME,
      UTI: XLSX_UTI,
      dialogTitle: 'Guardar o compartir el Excel',
    });
  },
};
