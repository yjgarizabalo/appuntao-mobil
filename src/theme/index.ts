/**
 * Tema semántico.
 *
 * Los tokens de `tokens.ts` son la escala cruda (`ink[500]`, `brand[500]`).
 * Aquí se les da un **rol**: `text`, `textMuted`, `border`, `danger`…
 * Los componentes solo consumen roles, nunca la escala. Gracias a eso, el día
 * que se agregue modo oscuro basta con devolver otro objeto de roles desde
 * `useTheme()` sin tocar una sola pantalla.
 */
import { duration, fontWeight, layout, palette, radius, shadow, spacing, spring, typography } from './tokens';

const { brand, lime, success, ink, danger, warning, info } = palette;

const colors = {
  /* Superficies */
  /** Fondo de pantalla. */
  bg: ink[50],
  /** Tarjetas y hojas. */
  surface: ink[0],
  /** Superficie sutilmente distinta al fondo (filas alternas, inputs). */
  surfaceMuted: ink[25],
  /** Superficie hundida: campos, contenedores de progreso. */
  surfaceSunken: ink[100],
  /** Superficie oscura: héroes de saldo, tarjetas destacadas. */
  surfaceInverse: ink[900],
  surfaceInverseSoft: ink[800],

  /* Texto */
  text: ink[800],
  textMuted: ink[500],
  textSubtle: ink[400],
  textInverse: ink[0],
  textInverseMuted: 'rgba(255,255,255,0.68)',
  textInverseSubtle: 'rgba(255,255,255,0.45)',

  /* Bordes y separadores */
  border: ink[100],
  borderStrong: ink[200],
  borderInverse: 'rgba(255,255,255,0.14)',

  /*
   * Rellenos sobre superficies oscuras (héroes con degradado). Son blanco
   * translúcido y no un azul fijo para que tomen el tono del degradado que
   * tengan debajo, sea cual sea.
   */
  /** Controles presionables: botón de perfil, selector de modo y de negocio. */
  fillInverse: 'rgba(255,255,255,0.12)',
  /** Zonas y tarjetas apoyadas en el héroe: estadísticas, `StatTile` inverso. */
  fillInverseSubtle: 'rgba(255,255,255,0.08)',

  /* Marca */
  brand: brand[500],
  brandStrong: brand[600],
  brandPressed: brand[700],
  brandSoft: brand[50],
  brandSoftStrong: brand[100],
  brandOn: ink[0],
  /** Azul profundo del logotipo: nombre de marca y detalles oscuros. */
  brandDeep: brand[800],

  /* Acento lima: checks y detalles destacados, nunca texto sobre blanco. */
  accent: lime[500],
  accentStrong: lime[600],
  accentSoft: lime[50],
  accentOn: brand[800],

  /* Semántico */
  danger: danger[500],
  dangerStrong: danger[600],
  dangerSoft: danger[50],
  dangerSoftStrong: danger[100],
  dangerOn: ink[0],

  warning: warning[500],
  warningStrong: warning[600],
  warningSoft: warning[50],
  warningSoftStrong: warning[100],
  warningOn: ink[900],

  info: info[500],
  infoStrong: info[600],
  infoSoft: info[50],
  /** Texto sobre `info` sólido: el cian da 4.8:1 con `ink[900]` y solo 3.7:1 con blanco. */
  infoOn: ink[900],

  success: success[500],
  successSoft: success[50],

  /* Otros */
  overlay: 'rgba(10, 23, 54, 0.6)',
  skeleton: ink[100],
  skeletonHighlight: ink[50],
  disabled: ink[200],
  disabledText: ink[400],
} as const;

/** Degradados de marca. Se usan en los héroes de saldo y el splash. */
const gradients = {
  /** Del azul casi negro al azul profundo de la libreta: tarjeta principal de saldo. */
  hero: [ink[900], brand[800], brand[700]] as const,
  /** Azul marca: botones y superficies destacadas. */
  brand: [brand[400], brand[600]] as const,
  /** Rojo suave: estado "en mora". */
  danger: [danger[500], danger[700]] as const,
  /** Velo para leer texto sobre una imagen. */
  scrim: ['rgba(10,23,54,0)', 'rgba(10,23,54,0.75)'] as const,
} as const;

export const theme = {
  color: colors,
  gradient: gradients,
  spacing,
  radius,
  typography,
  fontWeight,
  shadow,
  duration,
  spring,
  layout,
  palette,
} as const;

export type Theme = typeof theme;
export type ThemeColor = keyof typeof colors;

/**
 * Acceso al tema desde componentes.
 *
 * Hoy devuelve una constante (la app es de tema claro, igual que antes).
 * Es un hook —y no un import directo— para que activar el modo oscuro más
 * adelante sea cambiar esta función y nada más.
 */
export const useTheme = (): Theme => theme;

export { palette, spacing, radius, typography, shadow, layout } from './tokens';
