/**
 * Documentos legales: términos y condiciones, política de tratamiento de
 * datos personales, acuerdo de transmisión de datos para negocios y los que
 * se agreguen.
 *
 * **La app no conoce la lista de tipos.** El backend tiene un catálogo
 * (`LegalDocumentKind`) y cada documento llega con su `title`, su `audience`
 * (a quién se le exige) y si es `required`. Un tipo nuevo aparece en la app sin
 * sacar otra versión: si la app filtrara por una lista propia, enviaría menos
 * ids de los que el backend exige y el registro fallaría.
 *
 * Los textos **ya no viajan en el bundle**: los publica el backend
 * (`GET /legal/current`) y la app los muestra tal cual. Es lo que exige la
 * prueba de la autorización (Ley 1581 de 2012): el backend guarda la huella
 * SHA-256 del texto que sirvió y el id de la versión que el usuario aceptó.
 * Si la app mostrara una copia propia, esa prueba no diría nada de lo que el
 * usuario leyó de verdad.
 *
 * Vive en `domain` porque lo usan el registro (`features/auth`), la creación
 * de negocios (`features/businesses`), la lectura y la reaceptación
 * (`features/legal`).
 *
 * El contenido llega en Markdown. Se interpreta un subconjunto mínimo —el que
 * usan los documentos del backend— para pintarlo con el design system en vez
 * de depender de una librería de Markdown (las versiones están congeladas):
 *
 *   # Título del documento
 *   ## 1. Título de la cláusula
 *   Párrafo (las líneas seguidas se unen; una línea en blanco separa párrafos).
 *   - Viñeta
 *
 * Lo que quede antes del primer `##` es la introducción. `**negrita**` se
 * limpia: el texto se muestra completo aunque pierda el énfasis.
 */

/* ── Tipos del backend ───────────────────────────────────────────────────── */

/** Código del tipo en el catálogo del backend (`PRIVACY_POLICY`…). Abierto a propósito. */
export type LegalDocumentType = string;

/**
 * A quién se le exige un documento. Son los momentos en que la app pide
 * aceptar: al registrarse y al crear un negocio.
 */
export const LEGAL_AUDIENCES = {
  /** Todo usuario, desde el registro. */
  allUsers: 'ALL_USERS',
  /** Quien crea o tiene un negocio: Responsable de los datos de sus clientes. */
  businessOwners: 'BUSINESS_OWNERS',
} as const;

export type LegalAudience = (typeof LEGAL_AUDIENCES)[keyof typeof LEGAL_AUDIENCES];

/** Lo que devuelven login y refresh en `pendingLegalDocuments`. */
export interface LegalDocumentSummary {
  id: string;
  type: LegalDocumentType;
  version: string;
  /** Nombre para mostrar, tal como lo define el catálogo. */
  title: string;
}

/** Un documento vigente, como lo sirve `GET /legal/current`. */
export interface LegalDocument extends LegalDocumentSummary {
  /** `null` si el backend envía un público que esta versión de la app no conoce. */
  audience: LegalAudience | null;
  /** `false` = consentimiento opcional: no bloquea ni queda pendiente. */
  required: boolean;
  /** Texto completo en Markdown. */
  content: string;
  contentHash: string;
  /** Página pública donde también está publicado, si existe. */
  url: string | null;
  /** Desde cuándo rige (ISO). */
  publishedAt: string;
}

/** "A", "A y B", "A, B y C". */
export const joinLegalTitles = (documents: readonly LegalDocumentSummary[]): string => {
  const titles = documents.map((doc) => doc.title);
  return titles.length <= 1
    ? (titles[0] ?? '')
    : `${titles.slice(0, -1).join(', ')} y ${titles[titles.length - 1]}`;
};

/* ── Documento interpretado para pintar ──────────────────────────────────── */

/** Un bloque dentro de una cláusula: párrafo corrido o lista de viñetas. */
export type LegalBlock =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[] };

export interface LegalSection {
  /** Numeración tal como aparece en el documento ("26"), o la posición si no trae. */
  number: string;
  title: string;
  blocks: LegalBlock[];
}

export interface ParsedLegalContent {
  /** El `#` del documento; `null` si no trae (se usa el `title` del catálogo). */
  title: string | null;
  /** Bloques antes de la primera cláusula. */
  intro: LegalBlock[];
  sections: LegalSection[];
}

/** Pie del documento: quién responde y dónde encontrarlo. */
export interface LegalContact {
  name: string;
  tagline: string;
  website: string;
  email: string;
}

/**
 * Responsable del tratamiento. Es de la empresa, no de una versión del
 * documento, por eso sigue en la app.
 */
export const LEGAL_CONTACT: LegalContact = {
  name: 'Appuntao',
  tagline: 'Organiza tus cuentas por cobrar de forma fácil y segura.',
  website: 'https://elfiao.com/',
  email: 'soporte@elfiao.com',
};

/* ── Intérprete de Markdown ──────────────────────────────────────────────── */

const SECTION_NUMBER = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/;
const BULLET = /^[-*]\s+(.+)$/;

const cleanInline = (text: string): string =>
  text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').trim();

/**
 * Convierte el Markdown del backend en cláusulas. Nunca lanza: un documento
 * con un formato inesperado se muestra como párrafos, que es mejor que no
 * mostrar nada.
 */
export const parseLegalContent = (content: string): ParsedLegalContent => {
  const result: ParsedLegalContent = { title: null, intro: [], sections: [] };

  let blocks = result.intro;
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: 'text', text: cleanInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };

  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushBullets();
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      const heading = cleanInline(line.slice(3));
      const match = SECTION_NUMBER.exec(heading);
      const section: LegalSection = {
        number: match?.[1] ?? String(result.sections.length + 1),
        title: match?.[2] ?? heading,
        blocks: [],
      };
      result.sections.push(section);
      blocks = section.blocks;
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushBullets();
      result.title ??= cleanInline(line.slice(2));
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet?.[1]) {
      // Una viñeta corta el párrafo que venía, pero no la lista.
      flushParagraph();
      bullets.push(cleanInline(bullet[1]));
      continue;
    }

    // Texto después de una lista: la lista terminó.
    flushBullets();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  return result;
};
