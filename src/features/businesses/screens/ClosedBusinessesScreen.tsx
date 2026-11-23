/**
 * Negocios cerrados del usuario, como dueño (`GET /business/closed`).
 *
 * Un negocio cerrado deja de aparecer en la app, pero sus datos se conservan
 * hasta la fecha de borrado. Mientras tanto, aquí el dueño puede descargar el
 * Excel o reabrirlo: vuelven sus clientes, sus deudas y su equipo.
 *
 * Tocar un negocio abre un diálogo con las dos acciones. Pasada la fecha ya
 * no se puede reabrir, pero se sigue pudiendo descargar hasta que el
 * mantenimiento nocturno lo borre.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { formatLongDate } from '@/core/utils/format';
import { businessApi, type ClosedBusiness } from '@/features/businesses/api/businessApi';
import { exportApi } from '@/features/businesses/api/exportApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  Badge,
  Dialog,
  EmptyState,
  ErrorState,
  IconBubble,
  ListRow,
  ListSkeleton,
  Screen,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const ClosedBusinessesScreen = () => {
  const { refresh: refreshBusinesses, selectBusiness } = useBusinesses();
  const dialog = useDialog();
  const toast = useToast();
  const [isBusy, setIsBusy] = useState(false);

  const closed = useAsyncData(businessApi.listClosed);

  const download = async (business: ClosedBusiness) => {
    setIsBusy(true);
    try {
      await exportApi.downloadAndShare(business.id);
    } catch (caught) {
      dialog.showError(toAppError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const reactivate = async (business: ClosedBusiness) => {
    setIsBusy(true);
    try {
      await businessApi.reactivate(business.id);
      await refreshBusinesses();
      selectBusiness(business.id);
      toast.success(`${business.name} está abierto otra vez`);
      await closed.refresh();
    } catch (caught) {
      dialog.showError(toAppError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const handlePress = (business: ClosedBusiness) => {
    const deletion = formatLongDate(business.dataDeletionScheduledAt);
    if (!business.canReactivate) {
      dialog.confirm({
        tone: 'info',
        title: business.name,
        message: 'Venció el plazo para reabrirlo y su información se va a eliminar. Todavía puedes descargarla.',
        confirmLabel: 'Descargar Excel',
        cancelLabel: 'Volver',
        onConfirm: () => download(business),
      });
      return;
    }
    dialog.confirm({
      tone: 'info',
      title: business.name,
      message: `Su información se elimina el ${deletion}. Antes de esa fecha puedes reabrirlo (vuelven sus clientes, deudas y equipo) o descargar el Excel.`,
      confirmLabel: 'Reabrir negocio',
      cancelLabel: 'Descargar Excel',
      onConfirm: () => reactivate(business),
      onCancel: () => {
        void download(business);
      },
    });
  };

  return (
    <Screen>
      <AppBar
        onBack={() => router.back()}
        title="Negocios cerrados"
        subtitle="Puedes reabrirlos o descargar su información"
      />

      {closed.isLoading && !closed.data ? (
        <View style={styles.skeletonHost}>
          <ListSkeleton count={3} />
        </View>
      ) : closed.error && !closed.data ? (
        <ErrorState error={closed.error} onRetry={closed.reload} />
      ) : (
        <FlatList
          data={closed.data ?? []}
          keyExtractor={(business) => business.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={closed.isRefreshing}
              onRefresh={closed.refresh}
              tintColor={theme.color.brand}
              colors={[theme.color.brand]}
            />
          }
          renderItem={({ item: business }) => (
            <ListRow
              leading={<IconBubble icon="storefront-outline" tone="neutral" />}
              title={business.name}
              subtitle={`Cerrado el ${formatLongDate(business.inactivatedAt)} · se elimina el ${formatLongDate(business.dataDeletionScheduledAt)}`}
              trailing={
                business.canReactivate ? undefined : <Badge label="Por eliminar" tone="danger" />
              }
              onPress={isBusy ? undefined : () => handlePress(business)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="No tienes negocios cerrados"
              message="Si cierras un negocio, aparece aquí hasta que se elimine su información."
            />
          }
        />
      )}

      <Dialog {...dialog.props} loading={isBusy} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  skeletonHost: {
    paddingHorizontal: theme.layout.gutter,
  },
  listContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: 120,
    flexGrow: 1,
  },
  separator: {
    height: theme.spacing.sm,
  },
});
