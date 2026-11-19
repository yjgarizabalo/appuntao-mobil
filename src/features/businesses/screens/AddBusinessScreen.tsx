/**
 * Creación de un negocio.
 *
 * Es la primera pantalla real de un usuario nuevo (sin negocio no hay
 * clientes), así que explica para qué sirve en lugar de mostrar dos campos
 * sueltos.
 *
 * Quien crea un negocio pasa a ser Responsable de los datos de sus clientes y
 * Appuntao los trata por cuenta suya (Encargado). Por eso, antes de crearlo,
 * se aceptan los documentos para negocios (`GET /legal/current?audience=
 * BUSINESS_OWNERS`), con el mismo cuidado que el registro: sin documentos
 * cargados no se envía, y si cambiaron mientras llenaba el formulario se pide
 * aceptarlos de nuevo.
 *
 * Si el backend no trae ninguno, no hay tarjeta: el catálogo decide qué se
 * exige, y si faltara publicar algo obligatorio el backend lo dice (503).
 * Volver a aceptar al crear el segundo negocio no estorba: es un toque y el
 * backend ignora la aceptación repetida.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useForm } from '@/core/hooks/useForm';
import { minLength, required } from '@/core/utils/validation';
import { joinLegalTitles, type LegalDocument } from '@/domain/legal';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalAcceptance } from '@/features/legal/components/LegalAcceptance';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  Screen,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const AddBusinessScreen = () => {
  const { createBusiness, isEmpty: isFirstBusiness } = useBusinesses();
  const dialog = useDialog();
  const toast = useToast();
  const legal = useAsyncData(legalApi.forBusiness);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState<string | undefined>(undefined);

  const handleAcceptLegal = (accepted: boolean) => {
    setAcceptedLegal(accepted);
    if (accepted) setLegalError(undefined);
  };

  const form = useForm({
    initialValues: { name: '', address: '' },
    rules: {
      name: [required('El nombre del negocio'), minLength(3, 'El nombre')],
      address: [required('La dirección')],
    },
    onSubmit: async (values) => {
      const documents = legal.data;
      if (!documents) {
        setLegalError('Necesitamos cargar los documentos legales antes de crear tu negocio.');
        haptics.warning();
        void legal.reload();
        return;
      }
      if (documents.length && !acceptedLegal) {
        setLegalError('Debes aceptar los documentos para crear tu negocio');
        haptics.warning();
        return;
      }

      try {
        const created = await createBusiness({
          name: values.name.trim(),
          address: values.address.trim(),
          acceptedLegalDocumentIds: documents.map((doc) => doc.id),
        });
        toast.success(`${created.name} está listo`);
        router.back();
      } catch (caught) {
        const error = toAppError(caught);

        // ¿Se publicó una versión nueva mientras llenaba el formulario? Se
        // compara contra el backend, no contra el texto del error.
        if (error.code === 'VALIDATION' || error.status === 503) {
          const fresh = await legalApi.forBusiness().catch(() => null);
          if (fresh && !sameDocuments(fresh, documents)) {
            legal.setData(fresh);
            setAcceptedLegal(false);
            setLegalError(
              fresh.length
                ? 'Actualizamos nuestros documentos para negocios. Léelos y vuelve a aceptarlos.'
                : undefined,
            );
            haptics.warning();
            return;
          }
        }

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
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
          label={isFirstBusiness ? 'Crear mi negocio' : 'Guardar negocio'}
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <IconBubble icon="storefront" tone="brand" size={56} />

      <Text variant="title1" style={styles.title}>
        {isFirstBusiness ? 'Crea tu negocio' : 'Nuevo negocio'}
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Los clientes, las deudas y los pagos se organizan por negocio. Si tienes
        más de una tienda, podrás cambiar entre ellas cuando quieras.
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
        returnKeyType="done"
        onSubmitEditing={form.submit}
      />

      {legal.data?.length === 0 ? null : (
        <LegalAcceptance
          documents={legal.data}
          isLoading={legal.isLoading}
          loadError={legal.error}
          onRetry={legal.reload}
          accepted={acceptedLegal}
          onChange={handleAcceptLegal}
          statement={`He leído y acepto ${joinLegalTitles(legal.data ?? [])} de Appuntao. Declaro que cuento con la autorización de mis clientes para registrar sus datos.`}
          error={legalError}
          helper="Necesario para crear tu negocio."
        />
      )}

      <Dialog {...dialog.props} />
    </Screen>
  );
};

/** Mismos documentos y mismas versiones (los ids cambian con cada versión). */
const sameDocuments = (a: LegalDocument[], b: LegalDocument[]): boolean =>
  a.length === b.length && a.every((doc) => b.some((other) => other.id === doc.id));

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing['2xl'],
  },
});
