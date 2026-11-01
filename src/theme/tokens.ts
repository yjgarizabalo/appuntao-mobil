/**
 * Design tokens de Fiao.
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

/** Verde marca: dinero, saldo al día, acciones primarias. */
const brand = {
  50: '#E8FAF1',
  100: '#C6F2DE',
  200: '#8FE6BF',
  300: '#4FD69C',
  400: '#17C480',
  500: '#00B26B',
  600: '#009459',
  700: '#007647',
  800: '#005634',
} as const;

/** Neutros fríos. `ink` se usa para texto y superficies oscuras. */
const ink = {
  0: '#FFFFFF',
  25: '#FAFBFC',
  50: '#F4F6F8',
  100: '#E8ECF0',
  200: '#D3DAE1',
  300: '#B0BAC5',
  400: '#8592A0',
  500: '#63707E',
  600: '#495663',
  700: '#333E4A',
  800: '#1D262F',
  900: '#0B0F14',
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

/** Azul informativo. */
const info = {
  50: '#EAF2FF',
  100: '#D0E1FF',
  500: '#3B82F6',
  600: '#2563EB',
} as const;

export const palette = { brand, ink, danger, warning, info } as const;

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
