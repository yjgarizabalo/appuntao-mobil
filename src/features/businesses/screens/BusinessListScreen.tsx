/**
 * Lista de negocios.
 *
 * En el v1 esta pantalla existía dos veces (una como pestaña y otra como
 * pantalla apilada, con el código casi duplicado). Aquí hay una sola: la
 * pestaña. El negocio activo se marca de forma explícita y se puede cambiar
 * desde aquí, además del selector del inicio.
 *
 * La fila vive en `BusinessRow`, hermana de `DebtorRow`: comparten tokens de
 * tarjeta y esta lista comparte el ritmo (separador `sm`, gutter, `flexGrow`)
 * con la de Clientes, para que ambas pestañas se sientan iguales.
 */
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { haptics } from '@/core/haptics';
import { routes } from '@/core/navigation/routes';
import { BusinessRow } from '@/features/businesses/components/BusinessRow';
import { IncomingInvitationsCard } from '@/features/businesses/components/IncomingInvitationsCard';
import { IncomingTransfersCard } from '@/features/businesses/components/IncomingTransfersCard';
import {
  useBusinesses,
  useRefreshBusinessesOnFocus,
} from '@/features/businesses/state/BusinessProvider';
import { AppBar, EmptyState, ErrorState, Fab, ListSkeleton, Screen } from '@/ui';
import { theme } from '@/theme';

export const BusinessListScreen = () => {
  const { businesses, activeBusinessId, isLoading, error, refresh, selectBusiness } =
    useBusinesses();
  useRefreshBusinessesOnFocus();

  const handleSelect = (businessId: string) => {
    haptics.select();
    selectBusiness(businessId);
  };

  return (
    <Screen>
      <AppBar title="Mis negocios" subtitle="Cada negocio lleva sus propios vales" large />

      {isLoading && businesses.length === 0 ? (
        <View style={styles.skeletonHost}>
          <ListSkeleton count={4} />
        </View>
      ) : error && businesses.length === 0 ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : businesses.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title="Aún no tienes negocios"
          message="Crea tu tienda para empezar a registrar clientes y llevar sus vales."
          actionLabel="Crear negocio"
          onAction={() => router.push(routes.business.create)}
          tone="brand"
        />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(business) => business.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <IncomingTransfersCard />
              <IncomingInvitationsCard />
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              tintColor={theme.color.brand}
              colors={[theme.color.brand]}
            />
          }
          renderItem={({ item: business }) => (
            <BusinessRow
              business={business}
              isActive={business.id === activeBusinessId}
              onOpen={() => router.push(routes.tabs.clients)}
              onSelect={() => handleSelect(business.id)}
            />
          )}
        />
      )}

      <Fab label="Nuevo negocio" onPress={() => router.push(routes.business.create)} />
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
