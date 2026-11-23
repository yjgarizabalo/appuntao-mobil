/**
 * Negocio principal de cada usuario, guardado en el dispositivo.
 *
 * El negocio principal es con el que la app abre siempre: al iniciar sesión y
 * al volver a abrirla. Antes no existía: tras iniciar sesión se tomaba el
 * primero que devolvía el backend, que es el **último creado**.
 *
 * Por qué vive en el dispositivo y no en el backend: el backend no tiene ese
 * campo todavía, y la preferencia sirve igual guardada en local. El costo es
 * que no viaja a otro celular; si eso llega a importar, se mueve al backend sin
 * tocar las pantallas, porque todas pasan por `BusinessProvider`.
 *
 * Se guarda por `userId` en un solo objeto JSON —no una llave por usuario—
 * porque `StorageKeys` es un juego cerrado de llaves fijas, y dos cuentas que
 * comparten el celular (el dueño y su cajero) deben tener cada una el suyo.
 */
import { StorageKeys, getJson, setJson } from '@/core/storage/storage';

type FavoriteMap = Record<string, string>;

/** Lee el mapa; si lo guardado no es un objeto, se trata como vacío. */
const readMap = async (): Promise<FavoriteMap> => {
  const raw = await getJson<unknown>(StorageKeys.favoriteBusinesses);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as FavoriteMap;
};

/** Negocio principal del usuario en este dispositivo, o `null` si no eligió. */
export const readFavoriteBusinessId = async (userId: string): Promise<string | null> => {
  const value = (await readMap())[userId];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

/**
 * Guarda (o con `null`, quita) el negocio principal del usuario. Devuelve
 * `false` si el almacenamiento falló, para que la pantalla lo diga.
 */
export const writeFavoriteBusinessId = async (
  userId: string,
  businessId: string | null,
): Promise<boolean> => {
  const map = await readMap();
  if (businessId) {
    map[userId] = businessId;
  } else {
    delete map[userId];
  }
  return setJson(StorageKeys.favoriteBusinesses, map);
};
