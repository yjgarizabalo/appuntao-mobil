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
 *
 * Aquí también se elige el negocio **principal** (la estrella de cada fila),
 * con el que la app abre siempre. Mientras no haya uno, una nota en la
 * cabecera explica para qué sirve la estrella.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { haptics } from '@/core/haptics';
import { routes } from '@/core/navigation/routes';
import type { Business } from '@/domain/models';
import { BusinessRow } from '@/features/businesses/components/BusinessRow';
import { IncomingInvitationsCard } from '@/features/businesses/components/IncomingInvitationsCard';
import { IncomingTransfersCard } from '@/features/businesses/components/IncomingTransfersCard';
import {
  useBusinesses,
  useRefreshBusinessesOnFocus,
} from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  EmptyState,
  ErrorState,
  Fab,
  ListSkeleton,
  Screen,
  Text,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const BusinessListScreen = () => {
  const {
    businesses,
    activeBusinessId,
    favoriteBusinessId,
    isLoading,
    error,
    refresh,
    selectBusiness,
    setFavoriteBusiness,
  } = useBusinesses();
  useRefreshBusinessesOnFocus();
  const toast = useToast();

  /** Con un solo negocio no hay principal que elegir. */
  const canChooseFavorite = businesses.length > 1;
  const hasFavorite = businesses.some((business) => business.id === favoriteBusinessId);

  const handleSelect = (businessId: string) => {
    haptics.select();
    selectBusiness(businessId);
  };

  const handleToggleFavorite = async (business: Business) => {
    const isFavorite = business.id === favoriteBusinessId;
    const saved = await setFavoriteBusiness(isFavorite ? null : business.id);
    if (!saved) {
      toast.error('No pudimos guardar tu negocio principal. Intenta de nuevo.');
      return;
    }
    if (isFavorite) {
      toast.info(`${business.name} ya no es tu negocio principal.`);
    } else {
      toast.success(`Listo: la app abrirá siempre en ${business.name}.`);
    }
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
              {canChooseFavorite && !hasFavorite ? (
                <View style={styles.favoriteHint}>
                  <Ionicons name="star-outline" size={14} color={theme.color.textMuted} />
                  <Text variant="caption" color="textMuted" style={styles.favoriteHintText}>
                    Toca la estrella de tu negocio principal y la app abrirá siempre en él.
                  </Text>
                </View>
              ) : null}
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
              isFavorite={business.id === favoriteBusinessId}
              onOpen={() => router.push(routes.tabs.clients)}
              onSelect={() => handleSelect(business.id)}
              onToggleFavorite={
                canChooseFavorite ? () => void handleToggleFavorite(business) : undefined
              }
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
  favoriteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  favoriteHintText: {
    flex: 1,
  },
});
