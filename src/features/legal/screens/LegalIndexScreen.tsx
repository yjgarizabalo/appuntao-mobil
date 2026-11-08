/**
 * Documentos legales vigentes (`/legal`), desde el perfil.
 *
 * La lista es la que sirve el backend en ese momento, sin caché y sin una
 * lista propia: si el catálogo gana un tipo, aparece aquí sin sacar otra
 * versión de la app. Cada fila abre la lectura (`/legal/[type]`).
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatLongDate } from '@/core/utils/format';
import { legalApi } from '@/features/legal/api/legalApi';
import {
  AppBar,
  EmptyState,
  ErrorState,
  IconBubble,
  ListRow,
  ListSkeleton,
  Screen,
} from '@/ui';
import { theme } from '@/theme';

export const LegalIndexScreen = () => {
  const documents = useAsyncData(legalApi.current);

  const renderBody = () => {
    if (documents.isLoading) return <ListSkeleton count={3} />;
    if (documents.error) {
      return <ErrorState error={documents.error} onRetry={documents.reload} />;
    }
    if (!documents.data?.length) {
      return (
        <EmptyState
          icon="document-text-outline"
          title="Sin documentos publicados"
          message="Todavía no hay documentos legales vigentes. Intenta de nuevo más tarde."
          actionLabel="Reintentar"
          onAction={documents.reload}
        />
      );
    }

    return (
      <View style={styles.list}>
        {documents.data.map((doc) => {
          const since = formatLongDate(doc.publishedAt);
          return (
            <ListRow
              key={doc.id}
              leading={<IconBubble icon="document-text-outline" size={38} />}
              title={doc.title}
              subtitle={`${since ? `Vigente desde el ${since} · ` : ''}Versión ${doc.version}`}
              onPress={() => router.push(routes.legal.document(doc.type))}
              chevron
            />
          );
        })}
      </View>
    );
  };

  return (
    <Screen scroll padded>
      <AppBar onBack={() => router.back()} title="Documentos legales" />
      {renderBody()}
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
});
