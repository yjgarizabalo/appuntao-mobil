/**
 * Design tokens de Appuntao.
 *
 * Única fuente de verdad de color, espaciado, tipografía, radios y sombras.
 * Ningún componente debe escribir un hex, un padding o un tamaño de letra
 * "a mano": todo sale de aquí. Eso es lo que mantiene la app consistente
 * cuando crece.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/* ────────────────────────────────────────────────────────────────────────────
 * Escalas crudas
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Azul marca de Appuntao: acciones primarias, foco y héroes.
 *
 * Los dos extremos son los colores exactos del logotipo (medidos sobre
 * `assets/images/icon.png`): `500` es el azul principal del cuaderno
 * (#0066FF) y `800` el azul oscuro del monograma y de «puntao» (#0B2D6B).
 * Los tonos claros (50–400) mezclan `500` con blanco y los oscuros (600–700)
 * lo mezclan con `800`, para que toda la escala sea de la misma familia.
 *
 * Contraste con blanco: `500` 4.8:1 (AA para texto normal), `600` 6.2:1,
 * `700` 7.9:1. Por debajo de `500` ya no sirve para texto sobre blanco.
 */
const brand = {
  50: '#EBF3FF',
  100: '#D4E5FF',
  200: '#A8CBFF',
  300: '#73ABFF',
  400: '#3888FF',
  500: '#0066FF',
  600: '#0358DA',
  700: '#064AB5',
  800: '#0B2D6B',
} as const;

/**
 * Lima de acento: el check y los detalles del cuaderno (#B6FF00, el color
 * exacto del logo). Sobre blanco da 1.2:1, así que **nunca** es texto: va
 * como relleno con texto en azul oscuro (10.8:1) o como detalle sobre
 * superficies oscuras (14.5:1 sobre `ink[900]`). Los claros mezclan con
 * blanco y los oscuros con negro.
 */
const lime = {
  50: '#F8FFE6',
  100: '#EBFFB8',
  300: '#D2FF61',
  500: '#B6FF00',
  600: '#95D100',
  700: '#6D9900',
} as const;

/** Verde de éxito: deuda pagada, cliente al día. */
const success = {
  50: '#E8FAF1',
  100: '#C6F2DE',
  500: '#00B26B',
  600: '#009459',
} as const;

/**
 * Neutros fríos con tinte azul, para que el gris converse con la marca.
 * `50` es el blanco frío de la paleta (#F5F8FF): fondo de pantalla.
 */
const ink = {
  0: '#FFFFFF',
  25: '#FAFBFF',
  50: '#F5F8FF',
  100: '#E6ECF7',
  200: '#CFD8E8',
  300: '#A9B5CB',
  400: '#7E8BA5',
  500: '#5B6782',
  600: '#434E68',
  700: '#2E3850',
  800: '#17213A',
  900: '#0A1736',
} as const;

/** Rojo de deuda / acciones destructivas. */
const danger = {
  50: '#FEECEC',
  100: '#FBD5D5',
  300: '#F08C8C',
  500: '#E14848',
  600: '#C42E2E',
  700: '#9E2020',
} as const;

/** Ámbar de alerta / deuda por vencer. */
const warning = {
  50: '#FFF6E5',
  100: '#FFE7BF',
  500: '#F5A524',
  600: '#D18A0F',
  700: '#A66C05',
} as const;

/**
 * Cian informativo: avisos neutros, roles y badges de «próximamente».
 *
 * Es cian y no azul a propósito: con la marca en #0066FF, un azul informativo
 * (antes #3B82F6) se confundía con `brand` y un badge de aviso parecía una
 * acción. El cian queda entre la marca y el verde de éxito sin pisar a
 * ninguno. Contraste: `600` sobre `50` 4.9:1 (texto de badge, AA); `500`
 * sobre `50` 3.4:1 (íconos, ≥ 3:1); `100` sobre `ink[900]` 14.3:1 (toast).
 */
const info = {
  50: '#E8F8FC',
  100: '#C7EEF7',
  500: '#0891B2',
  600: '#0E7490',
} as const;

/**
 * Colores de avatar: el fondo de las iniciales de cada cliente.
 *
 * Son una lista y no una escala porque se eligen por hash del nombre: lo que
 * importa es que se distingan **entre sí** y que todos lleven texto blanco
 * legible. Las iniciales van en negrita, así que el mínimo es 3:1 (texto
 * grande); el más bajo de la lista es el teal, con 3.1:1. El ámbar es
 * `warning[700]` y no `500`: con blanco, `500` daba 2.0:1 y no se leía.
 * Incluye dos tonos de la marca para que la lista se sienta de la casa; el
 * resto son vecinos fríos y cálidos, sin llegar a ser un arcoíris.
 */
const avatar = [
  brand[500],
  '#5B7CFA',
  '#7C5CF5',
  '#C4479B',
  '#E0714A',
  warning[700],
  '#0FA3A3',
  brand[700],
] as const;

export const palette = { brand, lime, success, ink, danger, warning, info, avatar } as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Espaciado — escala de 4pt
 * ──────────────────────────────────────────────────────────────────────────── */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/* ────────────────────────────────────────────────────────────────────────────
 * Radios
 * ──────────────────────────────────────────────────────────────────────────── */

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;

/* ────────────────────────────────────────────────────────────────────────────
 * Tipografía
 *
 * Se usa la fuente del sistema (San Francisco en iOS, Roboto en Android):
 * es la que mejor se lee, no pesa en el bundle y evita el parpadeo de
 * fuentes personalizadas al arrancar.
 * ──────────────────────────────────────────────────────────────────────────── */

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export type FontWeightToken = keyof typeof fontWeight;

/**
 * Escala tipográfica. `letterSpacing` negativo en los tamaños grandes: es el
 * detalle que hace que los títulos se vean "diseñados" y no por defecto.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontWeight: fontWeight.heavy },
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: fontWeight.bold },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontWeight: fontWeight.bold },
  title3: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, fontWeight: fontWeight.semibold },
  bodyLg: { fontSize: 17, lineHeight: 24, letterSpacing: -0.1, fontWeight: fontWeight.regular },
  body: { fontSize: 15, lineHeight: 21, letterSpacing: 0, fontWeight: fontWeight.regular },
  bodyStrong: { fontSize: 15, lineHeight: 21, letterSpacing: 0, fontWeight: fontWeight.semibold },
  /**
   * Texto largo para leer de corrido (documentos legales, ayudas extensas).
   * Mismo cuerpo que `body` con más interlineado: en párrafos de muchos
   * renglones es lo que evita que el ojo salte de línea al volver.
   */
  prose: { fontSize: 15, lineHeight: 24, letterSpacing: 0, fontWeight: fontWeight.regular },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontWeight: fontWeight.regular },
  captionStrong: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontWeight: fontWeight.semibold },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8, fontWeight: fontWeight.bold },
  /** Cifras de dinero: ancho fijo para que no "bailen" al actualizarse. */
  moneyHero: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontWeight: fontWeight.heavy,
    fontVariant: ['tabular-nums'],
  },
  money: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

/* ────────────────────────────────────────────────────────────────────────────
 * Sombras
 *
 * iOS usa shadow*, Android necesita elevation: cada token declara ambos para
 * que la profundidad se vea igual en las dos plataformas.
 * ──────────────────────────────────────────────────────────────────────────── */

const makeShadow = (elevation: number, opacity: number, radiusPx: number, offsetY: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: ink[900],
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
    },
    android: { elevation },
    default: {},
  }) as ViewStyle;

export const shadow = {
  none: {} as ViewStyle,
  xs: makeShadow(1, 0.04, 4, 1),
  sm: makeShadow(2, 0.06, 8, 2),
  md: makeShadow(6, 0.09, 16, 6),
  lg: makeShadow(12, 0.14, 28, 12),
  xl: makeShadow(20, 0.2, 40, 18),
} as const;

export type ShadowToken = keyof typeof shadow;

/* ────────────────────────────────────────────────────────────────────────────
 * Movimiento
 * ──────────────────────────────────────────────────────────────────────────── */

export const duration = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 380,
} as const;

/** Curvas de spring para reanimated: firmes y sin rebote exagerado. */
export const spring = {
  snappy: { damping: 20, stiffness: 260, mass: 0.7 },
  soft: { damping: 24, stiffness: 160, mass: 0.9 },
  bouncy: { damping: 12, stiffness: 220, mass: 0.8 },
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Medidas de layout compartidas
 * ──────────────────────────────────────────────────────────────────────────── */

export const layout = {
  /** Padding horizontal estándar de pantalla. */
  gutter: spacing.xl,
  /** Alto mínimo táctil recomendado por las guías de accesibilidad. */
  hitSlopMin: 44,
  appBarHeight: 56,
  tabBarHeight: 60,
  fieldHeight: 54,
  buttonHeight: { sm: 38, md: 48, lg: 56 },
} as const;
