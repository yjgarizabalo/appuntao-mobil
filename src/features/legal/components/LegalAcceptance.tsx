/**
 * Casilla de aceptación de los documentos legales.
 *
 * La usan el registro, la creación de negocios y la pantalla de documentos
 * actualizados. Recibe los documentos **vigentes que hay que aceptar**, tal
 * como los sirvió el backend, y ofrece una fila de lectura por cada uno con el
 * `title` del catálogo. Una sola casilla los acepta todos: el backend exige la
 * versión vigente de cada obligatorio, así que aceptar uno sin el otro no
 * sirve de nada.
 *
 * La frase de la casilla la pone cada pantalla (`statement`), porque no se
 * consiente lo mismo al registrarse (autorizar el tratamiento de los datos
 * propios) que al crear un negocio (recibir el encargo de los datos de los
 * clientes).
 *
 * Va en una tarjeta propia: es un consentimiento, no un campo más del
 * formulario, y mezclarlo con "Seguridad" haría que se marque sin verlo.
 *
 * Son dos zonas táctiles separadas a propósito —la fila que marca y las filas
 * que abren cada documento—, en vez del enlace incrustado en la frase: un
 * enlace dentro de una fila presionable deja al usuario sin saber si al tocar
 * está aceptando o leyendo, y en Android la prioridad entre los dos toques
 * depende de dónde cae el dedo.
 *
 * Mientras los documentos cargan, fallan o no están publicados, la casilla no
 * se muestra: no se puede aceptar algo que no se ha podido ver.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { AppError } from '@/core/errors/AppError';
import { routes } from '@/core/navigation/routes';
import type { LegalDocumentSummary } from '@/domain/legal';
import { Button, Card, CheckboxField, Divider, PressableScale, Skeleton, Text } from '@/ui';
import { theme } from '@/theme';

export interface LegalAcceptanceProps {
  /** Documentos que se aceptan. `null` mientras cargan. */
  documents: LegalDocumentSummary[] | null;
  isLoading?: boolean;
  /** Error al cargarlos. */
  loadError?: AppError | null;
  onRetry?: () => void;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  /** Lo que se consiente al marcar la casilla (usa `joinLegalTitles`). */
  statement: string;
  /** Mensaje cuando se intentó continuar sin aceptar. */
  error?: string;
  /** Texto de ayuda bajo la casilla. */
  helper?: string;
  /** Qué se dice si el backend no tiene documentos publicados. */
  unavailableTitle?: string;
  unavailableMessage?: string;
}

export const LegalAcceptance = ({
  documents,
  isLoading,
  loadError,
  onRetry,
  accepted,
  onChange,
  statement,
  error,
  helper = 'Necesario para crear tu cuenta.',
  unavailableTitle = 'El registro no está disponible por ahora',
  unavailableMessage = 'Estamos publicando nuestros documentos legales. Vuelve a intentarlo en un rato.',
}: LegalAcceptanceProps) => (
  <Card padding="lg" style={styles.card}>
    <View style={styles.eyebrow}>
      <Ionicons name="shield-checkmark-outline" size={14} color={theme.color.textSubtle} />
      <Text variant="overline" color="textSubtle" uppercase>
        Tratamiento de datos
      </Text>
    </View>

    <Body
      documents={documents}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={onRetry}
      accepted={accepted}
      onChange={onChange}
      statement={statement}
      error={error}
      helper={helper}
      unavailableTitle={unavailableTitle}
      unavailableMessage={unavailableMessage}
    />
  </Card>
);

const Body = ({
  documents,
  isLoading,
  loadError,
  onRetry,
  accepted,
  onChange,
  statement,
  error,
  helper,
  unavailableTitle,
  unavailableMessage,
}: LegalAcceptanceProps) => {
  if (isLoading || (!documents && !loadError)) {
    return (
      <View style={styles.skeleton}>
        <Skeleton width="90%" />
        <Skeleton width="60%" />
      </View>
    );
  }

  if (loadError || !documents) {
    return (
      <View style={styles.notice}>
        <Text variant="body" color="textMuted">
          {loadError?.message ?? 'No pudimos cargar los documentos legales.'}
        </Text>
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        {onRetry ? (
          <Button label="Reintentar" onPress={onRetry} variant="secondary" size="sm" />
        ) : null}
      </View>
    );
  }

  if (!documents.length) {
    return (
      <View style={styles.notice}>
        <Text variant="bodyStrong">{unavailableTitle}</Text>
        <Text variant="body" color="textMuted">
          {unavailableMessage}
        </Text>
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        {onRetry ? (
          <Button label="Reintentar" onPress={onRetry} variant="secondary" size="sm" />
        ) : null}
      </View>
    );
  }

  return (
    <>
      <CheckboxField
        checked={accepted}
        onChange={onChange}
        error={error}
        label={statement}
      >
        {error ? null : (
          <Text variant="caption" color="textSubtle">
            {helper}
          </Text>
        )}
      </CheckboxField>

      {documents.map((doc) => (
        <View key={doc.id}>
          <View style={styles.separator}>
            <Divider />
          </View>

          <PressableScale
            onPress={() => router.push(routes.legal.document(doc.type))}
            haptic="tap"
            activeScale={0.99}
            style={styles.readRow}
            accessibilityRole="button"
            accessibilityLabel={`Leer ${doc.title}`}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.color.brandStrong} />
            <Text variant="captionStrong" color="brandStrong" style={styles.readLabel}>
              Leer {doc.title}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.color.brandStrong} />
          </PressableScale>
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.xl,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  skeleton: {
    gap: theme.spacing.sm,
  },
  notice: {
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  separator: {
    marginVertical: theme.spacing.md,
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    // Zona táctil completa aunque el texto sea de una sola línea.
    minHeight: theme.layout.hitSlopMin,
  },
  readLabel: {
    flex: 1,
  },
});
