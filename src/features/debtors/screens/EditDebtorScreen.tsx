/**
 * Edición de los datos de un cliente.
 *
 * Existe porque el dato se captura con prisa, de pie en el mostrador: un
 * celular mal tecleado deja al cliente sin recordatorio de WhatsApp y una
 * cédula equivocada impide encontrarlo en el buscador. Hasta ahora la única
 * salida era crear un cliente nuevo y duplicar su historial de deudas.
 *
 * Solo se envían al backend los campos que cambiaron: `PATCH /debtors/:id`
 * acepta un objeto parcial, y mandar el resto sin necesidad abriría la puerta
 * a pisar con datos viejos lo que otro usuario del negocio acabe de corregir.
 *
 * Al final está "Quitar cliente" (`PATCH /debtors/:id/inactivate`): para la
 * ficha duplicada por error o el cliente que ya no compra. Esta pantalla solo
 * la abren el dueño y el administrador, los mismos que el backend deja
 * inactivar.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useForm } from '@/core/hooks/useForm';
import { removeCache } from '@/core/storage/cache';
import { routes } from '@/core/navigation/routes';
import { formatMoney } from '@/core/utils/format';
import {
  documentNumber as documentNumberRule,
  documentNumberFor,
  minLength,
  phone as phoneRule,
  required,
} from '@/core/utils/validation';
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from '@/domain/constants';
import type { Debtor, DebtorDraft } from '@/domain/models';
import { debtorApi } from '@/features/debtors/api/debtorApi';
import {
  AppBar,
  Button,
  CardSkeleton,
  Dialog,
  ErrorState,
  OptionPicker,
  Screen,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

export const EditDebtorScreen = () => {
  const params = useLocalSearchParams<{ id?: string; businessId?: string }>();
  const dialog = useDialog();
  const toast = useToast();

  const debtorId = params.id ?? '';
  const businessId = params.businessId ?? '';

  /**
   * Se recarga el cliente en vez de recibirlo por parámetros de navegación:
   * los params de expo-router viajan como strings y otro usuario del negocio
   * pudo haberlo corregido mientras tanto.
   */
  const detail = useAsyncData<Debtor>(
    () => debtorApi.getById(debtorId, businessId),
    {
      enabled: debtorId.length > 0 && businessId.length > 0,
      deps: [debtorId, businessId],
    },
  );

  const debtor = detail.data ?? null;
  const [isRemoving, setIsRemoving] = useState(false);

  const removeDebtor = useCallback(async () => {
    setIsRemoving(true);
    try {
      await debtorApi.inactivate(debtorId, businessId);
      // El detalle guardado offline ya no debe volver a mostrarse.
      await removeCache(`debtor-detail:${businessId}:${debtorId}`);
      toast.success('Cliente quitado de tu lista');
      // El detalle que queda debajo respondería 404: se vuelve a la raíz y
      // se abre la lista, que se recarga sola al enfocarse.
      router.dismissAll();
      router.navigate(routes.tabs.clients);
    } catch (caught) {
      const error = toAppError(caught);
      if (error.code === 'FORBIDDEN') {
        dialog.show({
          tone: 'warning',
          title: 'No puedes quitar este cliente',
          message: 'Solo el dueño o un administrador del negocio pueden hacerlo.',
        });
        return;
      }
      // Un 400 trae el motivo del backend (por ejemplo, que tiene saldo).
      dialog.showError(error);
    } finally {
      setIsRemoving(false);
    }
  }, [businessId, debtorId, dialog, toast]);

  const askRemove = useCallback(() => {
    if (!debtor) return;
    const balance = debtor.totalBalance ?? 0;
    if (balance > 0) {
      dialog.show({
        tone: 'warning',
        title: 'Todavía te debe',
        message: `${debtor.name} tiene un saldo de ${formatMoney(balance)}. Registra el pago (o anula las deudas que registraste por error) antes de quitarlo.`,
      });
      return;
    }
    dialog.confirm({
      tone: 'danger',
      title: `¿Quitar a ${debtor.name}?`,
      message:
        'Deja de aparecer en tu lista y en tus totales. Su historial de deudas y pagos se conserva, pero no se puede deshacer: si vuelve, tendrás que registrarlo de nuevo.' +
        (debtor.isLinked ? ' También dejará de ver su cuenta en la app.' : ''),
      confirmLabel: 'Quitar cliente',
      onConfirm: () => void removeDebtor(),
    });
  }, [debtor, dialog, removeDebtor]);

  const form = useForm({
    initialValues: {
      name: debtor?.name ?? '',
      documentType: (debtor?.documentType ?? 'CC') as DocumentType,
      documentNumber: debtor?.documentNumber ?? '',
      phone: debtor?.phone ?? '',
    },
    // `useForm` reinicia los valores cuando cambia esta clave: sin ella el
    // formulario se quedaría vacío, porque se monta antes de que llegue el GET.
    resetKey: debtor?.id,
    rules: {
      name: [required('El nombre'), minLength(3, 'El nombre')],
      documentNumber: [documentNumberRule],
      phone: [phoneRule],
    },
    onSubmit: async (values) => {
      if (!debtor) return;

      // La regla del documento depende del tipo elegido.
      const documentError = documentNumberFor(values.documentType)(values.documentNumber);
      if (documentError) {
        form.setFieldError('documentNumber', documentError);
        return;
      }

      const changes: Partial<DebtorDraft> = {};
      if (values.name.trim() !== debtor.name) changes.name = values.name.trim();
      if (values.documentType !== debtor.documentType) {
        changes.documentType = values.documentType as DocumentType;
      }
      if (values.documentNumber.trim() !== debtor.documentNumber) {
        changes.documentNumber = values.documentNumber.trim();
      }
      if (values.phone.trim() !== debtor.phone) changes.phone = values.phone.trim();

      if (Object.keys(changes).length === 0) {
        toast.info('No cambiaste nada');
        router.back();
        return;
      }

      try {
        await debtorApi.update(debtorId, businessId, changes);
        toast.success('Datos del cliente actualizados');
        router.back();
      } catch (caught) {
        const error = toAppError(caught);

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        if (error.code === 'CONFLICT') {
          form.setFieldError(
            'documentNumber',
            'Ya tienes otro cliente con este documento en este negocio',
          );
          return;
        }
        if (error.code === 'FORBIDDEN') {
          dialog.show({
            tone: 'warning',
            title: 'No puedes editar este cliente',
            message:
              'Solo el dueño o un administrador del negocio pueden corregir los datos de un cliente.',
          });
          return;
        }
        dialog.showError(error);
      }
    },
  });

  /* ── Parámetros incompletos ────────────────────────────────────────────── */

  if (!debtorId || !businessId) {
    return (
      <Screen padded>
        <AppBar onBack={() => router.back()} title="Editar cliente" />
        <ErrorState
          error={toAppError(new Error('Faltan datos para abrir esta pantalla.'))}
          onRetry={() => router.back()}
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
        debtor ? (
          <Button
            label="Guardar cambios"
            onPress={form.submit}
            loading={form.isSubmitting}
            size="lg"
            fullWidth
          />
        ) : undefined
      }
    >
      <AppBar onBack={() => router.back()} />

      <Text variant="title1">Editar cliente</Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Corrige el nombre, el documento o el celular. Sus deudas y pagos no se tocan.
      </Text>

      {detail.isLoading ? (
        <View style={styles.loading}>
          <CardSkeleton height={72} />
          <CardSkeleton height={72} />
          <CardSkeleton height={72} />
        </View>
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.reload} />
      ) : (
        <>
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
            helper="Con el celular puedes llamarlo o cobrarle por WhatsApp"
            returnKeyType="done"
            onSubmitEditing={form.submit}
          />

          <View style={styles.removeSection}>
            <Text variant="bodyStrong">Quitar cliente</Text>
            <Text variant="caption" color="textMuted" style={styles.removeHint}>
              Para una ficha repetida o un cliente que ya no compra. Solo si no te debe nada.
            </Text>
            <Button
              label="Quitar de mi lista"
              variant="ghost"
              onPress={askRemove}
              loading={isRemoving}
              disabled={form.isSubmitting}
              fullWidth
            />
          </View>
        </>
      )}

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
  },
  loading: {
    gap: theme.spacing.md,
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
  removeSection: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.color.border,
    gap: theme.spacing.xs,
  },
  removeHint: {
    marginBottom: theme.spacing.xs,
  },
});
