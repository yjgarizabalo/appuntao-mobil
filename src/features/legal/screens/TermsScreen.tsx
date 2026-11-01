/**
 * Lectura de los Términos y Condiciones.
 *
 * La `AppBar` queda **fuera** del scroll (mismo patrón que Equipo o Clientes):
 * en un documento de 26 cláusulas, tener que volver arriba para encontrar el
 * botón de atrás es justo lo que hace que nadie lo lea. Por eso el scroll es
 * un `ScrollView` propio y no el de `Screen`.
 *
 * Esta pantalla es además la dueña del scroll, así que es la que puede saltar
 * a una cláusula: el documento le reporta dónde quedó cada una al medirse y
 * ella hace el `scrollTo`. Así el render del texto sigue sin saber nada de
 * cómo se desplaza.
 *
 * El pie con "Entendido" cierra sin aceptar nada: la aceptación es de la
 * casilla del registro, no de esta pantalla. Leer no es consentir.
 */
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { TERMS } from '@/domain/legal';
import { LegalDocumentView } from '@/features/legal/components/LegalDocumentView';
import { AppBar, Button, Screen } from '@/ui';
import { theme } from '@/theme';

export const TermsScreen = () => {
  const scrollRef = useRef<ScrollView>(null);

  /**
   * Dónde empieza cada cláusula dentro del scroll. En una ref y no en estado:
   * se reescribe en cada medición y no debe provocar un render. Se actualiza
   * sola cuando el índice se pliega o despliega, porque `onLayout` vuelve a
   * dispararse si las posiciones cambian.
   */
  const offsets = useRef<Record<string, number>>({});

  const handleSectionLayout = useCallback((sectionNumber: string, y: number) => {
    offsets.current[sectionNumber] = y;
  }, []);

  const jumpToSection = useCallback((sectionNumber: string) => {
    const y = offsets.current[sectionNumber];
    // Todavía sin medir (cláusula fuera de pantalla en el primer render): no
    // se salta a ciegas, es preferible no hacer nada.
    if (y === undefined) return;

    scrollRef.current?.scrollTo({
      // Un respiro arriba para que el título no quede pegado a la AppBar.
      y: Math.max(y - theme.spacing.lg, 0),
      animated: true,
    });
  }, []);

  return (
    <Screen
      footer={
        <Button
          label="Entendido"
          onPress={() => router.back()}
          variant="secondary"
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Términos y condiciones" bordered />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LegalDocumentView
          doc={TERMS}
          onSectionLayout={handleSectionLayout}
          onJumpToSection={jumpToSection}
        />
      </ScrollView>
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
});
