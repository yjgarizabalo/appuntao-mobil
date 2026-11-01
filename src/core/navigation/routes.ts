/**
 * Rutas de la aplicación, en un solo sitio.
 *
 * En el v1 las rutas estaban escritas como strings literales repartidos por 20
 * archivos (`router.push("/(client)/clientDetail?id=" + id)`), así que
 * renombrar una pantalla obligaba a buscar y reemplazar a mano y cualquier
 * typo solo se descubría al probar.
 *
 * Aquí cada ruta es una función o constante: el editor autocompleta y
 * renombrar una pantalla es cambiar una línea.
 *
 * Nota sobre la estructura de carpetas: los grupos entre paréntesis
 * (`(auth)`, `(app)`, `(tabs)`) no aparecen en la URL. Las subrutas usan
 * nombre en singular (`/client/new`) mientras las pestañas usan plural
 * (`/clients`) para que nunca coincidan dos archivos en la misma URL.
 */
import type { Href } from 'expo-router';

export const routes = {
  /** Puerta de entrada: decide entre login y home según la sesión. */
  root: '/' as Href,

  auth: {
    login: '/login' as Href,
    register: '/register' as Href,
  },

  tabs: {
    home: '/home' as Href,
    businesses: '/businesses' as Href,
    clients: '/clients' as Href,
    profile: '/profile' as Href,
  },

  business: {
    create: '/business/new' as Href,
  },

  team: {
    /** Equipo del negocio activo. */
    list: '/team' as Href,
    /** Invitar a alguien al negocio activo. */
    invite: '/team/invite' as Href,
  },

  invitation: {
    /** Unirse a un negocio con un código. */
    accept: '/invitation/accept' as Href,
  },

  client: {
    create: (businessId: string): Href =>
      ({ pathname: '/client/new', params: { businessId } }) as unknown as Href,
    detail: (debtorId: string, businessId: string): Href =>
      ({ pathname: '/client/[id]', params: { id: debtorId, businessId } }) as unknown as Href,
    edit: (debtorId: string, businessId: string): Href =>
      ({ pathname: '/client/edit', params: { id: debtorId, businessId } }) as unknown as Href,
  },

  /**
   * Modo cliente: lo que el usuario debe en las tiendas de **otros**.
   *
   * Es un grupo aparte (`app/(app)/(client)/`) con sus propias pestañas, no
   * una pantalla más dentro de las del tendero: las dos vistas responden
   * preguntas opuestas y mezclarlas en una sola barra confundía el "¿quién me
   * debe?" con el "¿cuánto debo?".
   *
   * Ojo de no confundirlo con `routes.client`, que es el cliente **del**
   * tendero (la ficha de deudor que él administra).
   */
  clientMode: {
    /** Inicio del cliente: total que debe y sus tiendas. */
    wallet: '/wallet' as Href,
    /** Extracto unificado de todas las tiendas. */
    movements: '/movements' as Href,
    /** Perfil dentro del modo cliente. */
    profile: '/me' as Href,
    /** Su cuenta en una tienda concreta. */
    store: (debtorId: string, businessId: string): Href =>
      ({ pathname: '/store/[id]', params: { id: debtorId, businessId } }) as unknown as Href,
  },

  /**
   * Documentos legales. Cuelgan de la raíz y no de `(auth)` ni de `(app)`
   * porque se leen desde los dos lados: antes de crear la cuenta y, más
   * adelante, desde el perfil de alguien que ya entró.
   */
  legal: {
    /** Términos y Condiciones y tratamiento de datos personales. */
    terms: '/legal/terms' as Href,
  },

  settings: {
    profile: '/settings/profile' as Href,
    security: '/settings/security' as Href,
  },
} as const;
