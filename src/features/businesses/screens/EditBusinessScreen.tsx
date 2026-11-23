/**
 * Editar el nombre y la dirección del negocio activo (`PATCH /business/:id`).
 *
 * Solo la abre el dueño: el backend rechaza a cualquier otro con 403. La
 * moneda no se edita (es COP) y los documentos legales ya se aceptaron al
 * crearlo.
 */
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { minLength, required } from '@/core/utils/validation';
import { businessApi } from '@/features/businesses/api/businessApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  Button,
  Dialog,
  EmptyState,
  Screen,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const EditBusinessScreen = () => {
  const { activeBusiness, refresh } = useBusinesses();
  const dialog = useDialog();
  const toast = useToast();

  const form = useForm({
    initialValues: {
      name: activeBusiness?.name ?? '',
      address: activeBusiness?.address ?? '',
    },
    rules: {
      name: [required('El nombre del negocio'), minLength(3, 'El nombre')],
      address: [required('La dirección')],
    },
    onSubmit: async (values) => {
      if (!activeBusiness) return;
      try {
        await businessApi.update(activeBusiness.id, {
          name: values.name.trim(),
          address: values.address.trim(),
        });
        await refresh();
        toast.success('Negocio actualizado');
        router.back();
      } catch (caught) {
        const error = toAppError(caught);
        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        dialog.showError(error);
      }
    },
  });

  if (!activeBusiness) {
    return (
      <Screen>
        <AppBar onBack={() => router.back()} title="Editar negocio" />
        <EmptyState
          icon="storefront-outline"
          title="Primero elige un negocio"
          message="Selecciona el negocio que quieres editar."
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Guardar cambios"
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Editar negocio" />

      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Así lo ven tu equipo y tus clientes en la app.
      </Text>

      <TextField
        label="Nombre del negocio"
        placeholder="Tienda La Esquina"
        icon="pricetag-outline"
        value={form.values.name}
        onChangeText={form.handleChange('name')}
        onBlur={form.handleBlur('name')}
        error={form.visibleError('name')}
        autoCapitalize="words"
        maxLength={100}
        returnKeyType="next"
      />

      <TextField
        label="Dirección"
        placeholder="Calle 45 #12-30, Barranquilla"
        icon="location-outline"
        value={form.values.address}
        onChangeText={form.handleChange('address')}
        onBlur={form.handleBlur('address')}
        error={form.visibleError('address')}
        autoCapitalize="sentences"
        maxLength={200}
        returnKeyType="done"
        onSubmitEditing={form.submit}
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: theme.spacing.xl,
  },
});
