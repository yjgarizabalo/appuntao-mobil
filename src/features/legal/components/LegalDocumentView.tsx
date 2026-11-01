/**
 * Render de un documento legal.
 *
 * Un texto legal se pierde si se pinta como un bloque corrido: aquí cada
 * cláusula lleva su número en color de marca, un título que se puede escanear
 * y una regla que la separa de la siguiente, de modo que el ojo encuentre
 * dónde va sin tener que leerlo todo.
 *
 * Con 26 cláusulas hace falta además un índice, y va **plegado** por defecto:
 * desplegado mide dos pantallas y empujaría el documento fuera de la vista,
 * que es justo lo contrario de lo que se busca. Quien va a una cláusula
 * concreta lo abre; quien viene a leer de corrido ni lo nota.
 *
 * Decisiones de legibilidad:
 *  - los párrafos usan la variante `prose` (mismo cuerpo que `body` con más
 *    interlineado): a ese ritmo la vista no salta de renglón en párrafos
 *    largos, que es justo lo que pasa en un documento como este;
 *  - el ancho útil lo limita el gutter de `Screen`, no este componente;
 *  - las viñetas son un `Text` con el punto, no una vista de N píxeles, para
 *    que el punto comparta línea base con su texto en las dos plataformas.
 *
 * Es presentacional: no sabe de dónde salió el documento ni cómo se desplaza
 * la pantalla. El salto del índice lo ejecuta quien monta el scroll
 * (`TermsScreen`), al que este componente le avisa por `onSectionLayout` dónde
 * quedó cada cláusula.
 */
import { Ionicons } from '@expo/vector-icons';
import { Fragment, useState } from 'react';
import { type LayoutChangeEvent, Linking, StyleSheet, View } from 'react-native';

import type { LegalBlock, LegalDocument, LegalSection } from '@/domain/legal';
import { Card, Divider, PressableScale, Text, useToast } from '@/ui';
import { theme } from '@/theme';

export interface LegalDocumentViewProps {
  doc: LegalDocument;
  /** Avisa dónde empieza cada cláusula dentro del scroll, para el índice. */
  onSectionLayout?: (sectionNumber: string, y: number) => void;
  /** Salta a una cláusula. Sin este handler el índice no se muestra. */
  onJumpToSection?: (sectionNumber: string) => void;
}

export const LegalDocumentView = ({
  doc,
  onSectionLayout,
  onJumpToSection,
}: LegalDocumentViewProps) => {
  const toast = useToast();

  /** Abrir un enlace puede fallar (sin navegador, sin app de correo): se avisa. */
  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir el enlace'));
  };

  return (
    <View>
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text variant="title1">{doc.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.color.textSubtle} />
          <Text variant="caption" color="textMuted" style={styles.metaText}>
            Vigente desde el {doc.effectiveFrom}
          </Text>
        </View>
      </View>

      {/* ── Índice ────────────────────────────────────────────────────────── */}
      {onJumpToSection ? (
        <TableOfContents sections={doc.sections} onSelect={onJumpToSection} />
      ) : null}

      {/* ── Cláusulas ─────────────────────────────────────────────────────── */}
      {doc.sections.map((section, index) => (
        <Fragment key={section.number}>
          {index > 0 ? <Divider /> : null}
          <Section section={section} onLayout={onSectionLayout} />
        </Fragment>
      ))}

      {/* ── Pie: quién responde ───────────────────────────────────────────── */}
      <Card padding="xl" style={styles.contact}>
        <Text variant="title2" color="brandStrong">
          {doc.contact.name}
        </Text>
        <Text variant="prose" color="textMuted">
          {doc.contact.tagline}
        </Text>

        <Divider />

        <ContactRow
          icon="globe-outline"
          label="Sitio web"
          value={doc.contact.website}
          onPress={() => openUrl(doc.contact.website)}
        />
        <ContactRow
          icon="mail-outline"
          label="Correo de contacto"
          value={doc.contact.email}
          onPress={() => openUrl(`mailto:${doc.contact.email}`)}
        />
      </Card>
    </View>
  );
};

/* ── Índice plegable ──────────────────────────────────────────────────────── */

interface TableOfContentsProps {
  sections: LegalSection[];
  onSelect: (sectionNumber: string) => void;
}

const TableOfContents = ({ sections, onSelect }: TableOfContentsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Card padding="lg" style={styles.toc}>
      <PressableScale
        onPress={() => setOpen((previous) => !previous)}
        haptic="tap"
        activeScale={0.99}
        style={styles.tocHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Ocultar el índice' : 'Ver el índice'}
      >
        <Ionicons name="list-outline" size={18} color={theme.color.textMuted} />

        <View style={styles.tocHeaderBody}>
          <Text variant="bodyStrong">Contenido</Text>
          <Text variant="caption" color="textSubtle">
            {sections.length} cláusulas
          </Text>
        </View>

        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.color.textSubtle}
        />
      </PressableScale>

      {open ? (
        <View style={styles.tocList}>
          {sections.map((section) => (
            <PressableScale
              key={section.number}
              onPress={() => onSelect(section.number)}
              haptic="select"
              activeScale={0.99}
              style={styles.tocRow}
              accessibilityRole="button"
              accessibilityLabel={`Ir a ${section.number}. ${section.title}`}
            >
              <Text variant="captionStrong" color="brandStrong" style={styles.tocNumber}>
                {section.number}
              </Text>
              <Text variant="caption" style={styles.tocTitle} numberOfLines={1}>
                {section.title}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </Card>
  );
};

/* ── Una cláusula ─────────────────────────────────────────────────────────── */

interface SectionProps {
  section: LegalSection;
  onLayout?: (sectionNumber: string, y: number) => void;
}

const Section = ({ section, onLayout }: SectionProps) => (
  <View
    style={styles.section}
    onLayout={(event: LayoutChangeEvent) =>
      onLayout?.(section.number, event.nativeEvent.layout.y)
    }
  >
    <View style={styles.sectionHeading}>
      <Text variant="title3" color="brandStrong">
        {section.number}.
      </Text>
      <Text variant="title3" style={styles.sectionTitle}>
        {section.title}
      </Text>
    </View>

    {section.blocks.map((block, index) => (
      <Block key={index} block={block} />
    ))}
  </View>
);

const Block = ({ block }: { block: LegalBlock }) => {
  if (block.kind === 'bullets') {
    return (
      <View style={styles.bullets}>
        {block.items.map((item, index) => (
          <View key={index} style={styles.bulletRow}>
            <Text variant="prose" color="brandStrong">
              •
            </Text>
            <Text variant="prose" style={styles.bulletText}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Text variant="prose" style={styles.paragraph}>
      {block.text}
    </Text>
  );
};

/* ── Fila de contacto ─────────────────────────────────────────────────────── */

interface ContactRowProps {
  icon: 'globe-outline' | 'mail-outline';
  label: string;
  value: string;
  onPress: () => void;
}

const ContactRow = ({ icon, label, value, onPress }: ContactRowProps) => (
  <PressableScale
    onPress={onPress}
    haptic="tap"
    activeScale={0.99}
    style={styles.contactRow}
    accessibilityRole="link"
    accessibilityLabel={`${label}: ${value}`}
  >
    <Ionicons name={icon} size={18} color={theme.color.brandStrong} />

    <View style={styles.contactBody}>
      <Text variant="overline" color="textSubtle" uppercase>
        {label}
      </Text>
      <Text variant="bodyStrong" color="brandStrong" numberOfLines={1}>
        {value}
      </Text>
    </View>

    <Ionicons name="open-outline" size={16} color={theme.color.textSubtle} />
  </PressableScale>
);

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    flex: 1,
  },
  toc: {
    marginBottom: theme.spacing.lg,
  },
  tocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  tocHeaderBody: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  tocList: {
    marginTop: theme.spacing.md,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  /** Columna de números alineada a la derecha: los de dos cifras no desplazan el título. */
  tocNumber: {
    minWidth: theme.spacing.xl,
    textAlign: 'right',
  },
  tocTitle: {
    flex: 1,
  },
  section: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  sectionHeading: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  paragraph: {
    // Los párrafos de una misma cláusula respiran menos que las cláusulas
    // entre sí: así se ven como un bloque y no como ideas sueltas.
    marginTop: theme.spacing.xxs,
  },
  bullets: {
    gap: theme.spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  bulletText: {
    flex: 1,
  },
  contact: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  contactBody: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
});
