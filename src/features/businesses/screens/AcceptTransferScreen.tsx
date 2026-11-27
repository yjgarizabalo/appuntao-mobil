/**
 * Aceptar una propuesta para quedarse con un negocio.
 *
 * Ser dueño es ser Responsable de los datos de los clientes del negocio. Por
 * eso, como al crear un negocio, antes de aceptar se leen y aceptan los
 * documentos para negocios (`GET /legal/current?audience=BUSINESS_OWNERS`), y
 * el backend los exige en `POST /business/ownership-transfers/:id/accept`.
 *
 * Si cambiaron mientras la pantalla estaba abierta, el backend rechaza y se
 * piden de nuevo, igual que en "Nuevo negocio".
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { joinLegalTitles, sameLegalDocuments } from '@/domain/legal';
import { ownershipApi } from '@/features/businesses/api/ownershipApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalAcceptance } from '@/features/legal/components/LegalAcceptance';
import { useLegalGate } from '@/features/legal/components/LegalGate';
import { AppBar, Button, Dialog, IconBubble, Screen, Text, useDialog, useToast } from '@/ui';
import { theme } from '@/theme';

export const AcceptTransferScreen = () => {
  const params = useLocalSearchParams<{
    transferId: string;
    businessId?: string;
    businessName?: string;
    fromName?: string;
  }>();
  const business = params.businessName || 'este negocio';
  const { refresh: refreshBusinesses, selectBusiness } = useBusinesses();
  const { recheck } = useLegalGate();
  const dialog = useDialog();
  const toast = useToast();
  const legal = useAsyncData(legalApi.forBusiness);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAcceptLegal = (accepted: boolean) => {
    setAcceptedLegal(accepted);
    if (accepted) setLegalError(undefined);
  };

  const submit = async () => {
    const documents = legal.data;
    if (!documents) {
      setLegalError('Necesitamos cargar los documentos legales antes de continuar.');
      haptics.warning();
      void legal.reload();
      return;
    }
    if (documents.length && !acceptedLegal) {
      setLegalError('Debes aceptar los documentos para quedarte con el negocio');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await ownershipApi.accept(
        params.transferId,
        documents.map((doc) => doc.id),
      );
      toast.success(message || `Ahora eres el dueño de ${business}`);
      await refreshBusinesses();
      if (params.businessId) selectBusiness(params.businessId);
      await recheck();
      router.replace(routes.tabs.home);
    } catch (caught) {
      const error = toAppError(caught);

      // ¿Se publicó una versión nueva mientras estaba aquí? Se compara contra
      // el backend, no contra el texto del error.
      if (error.code === 'VALIDATION' || error.status === 503) {
        const fresh = await legalApi.forBusiness().catch(() => null);
        if (fresh && !sameLegalDocuments(fresh, documents)) {
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

      // Venció, la cancelaron, ya no es miembro o llegó al tope: el backend
      // lo explica. Al cerrar el diálogo se vuelve a la tarjeta, que se
      // actualiza sola.
      dialog.showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      scroll
      padded
      footer={
        <Button
          label="Quedarme con el negocio"
          onPress={() => void submit()}
          loading={isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <IconBubble icon="swap-horizontal-outline" tone="brand" size={56} />
      <Text variant="title1" style={styles.title}>
        ¿Quedarte con {business}?
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        {params.fromName ? `${params.fromName} quiere pasarte el negocio. ` : ''}
        Serás el dueño: responderás por el negocio y por los datos de sus clientes. Quien te lo
        pasa quedará como administrador.
      </Text>

      {legal.data?.length === 0 ? null : (
        <LegalAcceptance
          documents={legal.data}
          isLoading={legal.isLoading}
          loadError={legal.error}
          onRetry={legal.reload}
          accepted={acceptedLegal}
          onChange={handleAcceptLegal}
          statement={`He leído y acepto ${joinLegalTitles(legal.data ?? [])} de Appuntao. Declaro que cuento con la autorización de los clientes del negocio para tratar sus datos.`}
          error={legalError}
          helper="Necesario para quedarte con el negocio."
        />
      )}

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing['2xl'],
  },
});
