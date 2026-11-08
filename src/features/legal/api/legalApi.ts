/**
 * API de documentos legales.
 *
 * Tres endpoints, uno por momento del recorrido:
 *
 *  - `GET /legal/current` (público): lo vigente. Con `audience` trae solo lo
 *    que se acepta en un momento: `ALL_USERS` en el registro y
 *    `BUSINESS_OWNERS` al crear un negocio. Sus `id` son los que viajan en
 *    `acceptedLegalDocumentIds`.
 *  - `GET /legal/pending` (con sesión): lo que un usuario ya registrado aún no
 *    ha aceptado, normalmente porque se publicó una versión nueva.
 *  - `POST /legal/accept` (con sesión): registra esa aceptación y devuelve lo
 *    que siga pendiente.
 *
 * Ninguno lleva caché offline a propósito: aceptar un texto viejo guardado en
 * el dispositivo es justo lo que el backend rechaza, y mostrarlo como vigente
 * sería engañar al usuario.
 */
import { http, skipAuthRefresh } from '@/core/http/client';
import { LEGAL_AUDIENCES, type LegalAudience, type LegalDocument } from '@/domain/legal';
import { mapLegalDocuments } from '@/domain/mappers';

const fetchCurrent = async (audience?: LegalAudience): Promise<LegalDocument[]> => {
  // Se pide también sin sesión (registro): un 401 aquí no es una sesión
  // vencida y no debe disparar la renovación.
  const { data } = await http.get('/legal/current', {
    ...skipAuthRefresh,
    params: audience ? { audience } : undefined,
  });
  return mapLegalDocuments(data);
};

/**
 * Lo que hay que aceptar en un momento: solo los obligatorios. Los opcionales
 * (si el catálogo llega a tener alguno) necesitan su propia casilla y no se
 * meten en la misma aceptación.
 */
const fetchRequired = async (audience: LegalAudience): Promise<LegalDocument[]> =>
  (await fetchCurrent(audience)).filter((doc) => doc.required);

export const legalApi = {
  /** `GET /legal/current` — todo lo vigente, para leer. Vacío si no hay nada publicado. */
  current: () => fetchCurrent(),

  /** Lo que se acepta al registrarse. */
  forRegistration: () => fetchRequired(LEGAL_AUDIENCES.allUsers),

  /** Lo que se acepta al crear un negocio. */
  forBusiness: () => fetchRequired(LEGAL_AUDIENCES.businessOwners),

  /** `GET /legal/pending` */
  pending: async (): Promise<LegalDocument[]> => {
    const { data } = await http.get('/legal/pending');
    return mapLegalDocuments(data);
  },

  /** `POST /legal/accept` — devuelve los que sigan pendientes. */
  accept: async (documentIds: string[]): Promise<LegalDocument[]> => {
    const { data } = await http.post('/legal/accept', { documentIds });
    return mapLegalDocuments(data);
  },
};
