/**
 * Registro de un cliente nuevo.
 *
 * Corrige un bug real del v1: allí `addClient` capturaba el error y solo hacía
 * `console.error`, pero la pantalla navegaba hacia atrás igual, así que el
 * tendero creía haber guardado un cliente que nunca se creó. Aquí, si falla,
 * se queda en el formulario con el error a la vista y los datos intactos.
 *
 * Al crearlo con éxito ofrece el siguiente paso natural: fiarle de una vez.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { routes } from '@/core/navigation/routes';
import {
  documentNumber as documentNumberRule,
  documentNumberFor,
  minLength,
  phone as phoneRule,
  required,
} from '@/core/utils/validation';
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from '@/domain/constants';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import {
  AppBar,
  Button,
  Dialog,
  OptionPicker,
  Screen,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

export const AddDebtorScreen = () => {
  const params = useLocalSearchParams<{ businessId?: string }>();
  const { activeBusinessId, getBusiness } = useBusinesses();
  const dialog = useDialog();

  const businessId = params.businessId ?? activeBusinessId ?? '';
  const business = businessId ? getBusiness(businessId) : undefined;

  const form = useForm({
    initialValues: {
      name: '',
      documentType: 'CC' as DocumentType,
      documentNumber: '',
      phone: '',
    },
    rules: {
      name: [required('El nombre'), minLength(3, 'El nombre')],
      documentNumber: [documentNumberRule],
      phone: [phoneRule],
    },
    onSubmit: async (values) => {
      if (!businessId) {
        dialog.show({
          tone: 'warning',
          title: 'Sin negocio seleccionado',
          message: 'Selecciona o crea un negocio antes de registrar clientes.',
        });
        return;
      }

      // La regla del documento depende del tipo elegido.
      const documentError = documentNumberFor(values.documentType)(values.documentNumber);
      if (documentError) {
        form.setFieldError('documentNumber', documentError);
        return;
      }

      try {
        const created = await debtorApi.create(businessId, {
          name: values.name.trim(),
          documentType: values.documentType as DocumentType,
          documentNumber: values.documentNumber.trim(),
          phone: values.phone.trim(),
        });

        dialog.show({
          tone: 'success',
          title: `${created.name.split(' ')[0]} ya está registrado`,
          message: '¿Quieres registrarle una deuda ahora?',
          confirmLabel: 'Sí, fiarle',
          cancelLabel: 'Después',
          onConfirm: () => router.replace(routes.client.detail(created.id, businessId)),
        });
      } catch (caught) {
        const error = toAppError(caught);

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        if (error.code === 'CONFLICT') {
          form.setFieldError(
            'documentNumber',
            'Ya tienes un cliente con este documento en este negocio',
          );
          return;
        }
        dialog.showError(error);
      }
    },
  });

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Guardar cliente"
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <Text variant="title1">Nuevo cliente</Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        {business
          ? `Se registrará en ${business.name}.`
          : 'Se registrará en tu negocio activo.'}
      </Text>

      <TextField
        label="Nombre completo"
        placeholder="María José Pérez"
        icon="person-outline"
        value={form.values.name}
        onChangeText={form.handleChange('name')}
        onBlur={form.handleBlur('name')}
        error={form.visibleError('name')}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={styles.row}>
        <OptionPicker
          label="Tipo"
          value={form.values.documentType}
          options={DOCUMENT_TYPE_OPTIONS}
          onChange={(value) => form.setValue('documentType', value)}
          sheetTitle="Tipo de documento"
          containerStyle={styles.documentType}
        />
        <TextField
          label="Número de documento"
          placeholder="1020304050"
          value={form.values.documentNumber}
          onChangeText={form.handleChange('documentNumber')}
          onBlur={form.handleBlur('documentNumber')}
          error={form.visibleError('documentNumber')}
          keyboardType="number-pad"
          containerStyle={styles.documentNumber}
        />
      </View>

      <TextField
        label="Celular"
        placeholder="300 123 4567"
        icon="call-outline"
        value={form.values.phone}
        onChangeText={form.handleChange('phone')}
        onBlur={form.handleBlur('phone')}
        error={form.visibleError('phone')}
        keyboardType="phone-pad"
        helper="Con el celular podrás llamarlo para cobrar desde la app"
        returnKeyType="done"
        onSubmitEditing={form.submit}
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  documentType: {
    width: 118,
  },
  documentNumber: {
    flex: 1,
  },
});
