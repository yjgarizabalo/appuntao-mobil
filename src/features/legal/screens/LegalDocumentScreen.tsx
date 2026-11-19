/**
 * Lectura de un documento legal vigente (`/legal/PRIVACY_POLICY`…). El segmento
 * es el código del catálogo del backend.
 *
 * El texto se pide al backend cada vez que se abre, sin caché: es la versión
 * que rige hoy y la que el usuario va a aceptar, no la que quedó guardada en
 * el teléfono la última vez.
 *
 * La `AppBar` queda **fuera** del scroll (mismo patrón que Equipo o Clientes):
 * en un documento largo, tener que volver arriba para encontrar el botón de
 * atrás es justo lo que hace que nadie lo lea. Por eso el scroll es un
 * `ScrollView` propio y no el de `Screen`.
 *
 * Esta pantalla es además la dueña del scroll, así que es la que puede saltar
 * a una cláusula: el documento le reporta dónde quedó cada una al medirse y
 * ella hace el `scrollTo`.
 *
 * El pie con "Entendido" cierra sin aceptar nada: la aceptación es de la
 * casilla del registro o de la pantalla de documentos actualizados, no de
 * esta. Leer no es consentir.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAsyncData } from '@/core/hooks/useAsyncData';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalDocumentView } from '@/features/legal/components/LegalDocumentView';
import { AppBar, Button, EmptyState, ErrorState, Screen, Skeleton } from '@/ui';
import { theme } from '@/theme';

export const LegalDocumentScreen = () => {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = typeof params.type === 'string' && params.type ? params.type : null;

  const documents = useAsyncData(legalApi.current, { enabled: type !== null, deps: [type] });
  const doc = documents.data?.find((item) => item.type === type) ?? null;

  const scrollRef = useRef<ScrollView>(null);

  /**
   * Dónde empieza cada cláusula dentro del scroll. En una ref y no en estado:
   * se reescribe en cada medición y no debe provocar un render.
   */
  const offsets = useRef<Record<string, number>>({});

  const handleSectionLayout = useCallback((sectionNumber: string, y: number) => {
    offsets.current[sectionNumber] = y;
  }, []);

  const jumpToSection = useCallback((sectionNumber: string) => {
    const y = offsets.current[sectionNumber];
    // Todavía sin medir: no se salta a ciegas, es preferible no hacer nada.
    if (y === undefined) return;

    scrollRef.current?.scrollTo({
      // Un respiro arriba para que el título no quede pegado a la AppBar.
      y: Math.max(y - theme.spacing.lg, 0),
      animated: true,
    });
  }, []);

  const title = doc?.title ?? 'Documento legal';

  const footer = (
    <Button
      label="Entendido"
      onPress={() => router.back()}
      variant="secondary"
      size="lg"
      fullWidth
    />
  );

  /* ── Carga, error y documento no publicado ─────────────────────────────── */

  let body: ReactNode;

  if (type && documents.isLoading) {
    body = (
      <View style={styles.skeleton}>
        <Skeleton width="80%" height={28} />
        <Skeleton width="45%" />
        <Skeleton height={120} radius={theme.radius.lg} />
        <Skeleton height={120} radius={theme.radius.lg} />
      </View>
    );
  } else if (type && documents.error) {
    body = <ErrorState error={documents.error} onRetry={documents.reload} />;
  } else if (!doc) {
    // Ruta desconocida o el backend no tiene este documento publicado. No se
    // muestra una copia vieja: no hay nada vigente que leer.
    body = (
      <EmptyState
        icon="document-text-outline"
        title="Documento no disponible"
        message="Este documento todavía no está publicado. Intenta de nuevo más tarde."
        actionLabel={type ? 'Reintentar' : undefined}
        onAction={type ? documents.reload : undefined}
      />
    );
  } else {
    body = (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LegalDocumentView
          doc={doc}
          onSectionLayout={handleSectionLayout}
          onJumpToSection={jumpToSection}
        />
      </ScrollView>
    );
  }

  return (
    <Screen footer={footer}>
      <AppBar onBack={() => router.back()} title={title} bordered />
      {body}
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing['3xl'],
  },
  skeleton: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.xl,
  },
});
