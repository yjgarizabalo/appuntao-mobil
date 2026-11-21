/**
 * Invitar a alguien al negocio activo, por correo o por WhatsApp.
 *
 * Formulario Tier C con un conmutador de método:
 *  - **Correo**: el backend crea la invitación y manda un correo (Resend).
 *  - **WhatsApp**: se crea la invitación con el teléfono y la app abre WhatsApp
 *    con el mensaje y el código ya escritos, igual que los recordatorios de
 *    cobro. El backend no manda WhatsApp; el envío lo confirma quien invita.
 *
 * En ambos casos se muestra el código como respaldo: la persona lo teclea en
 * "Tengo un código" para unirse (el flujo es por código, no por deep link).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useForm } from '@/core/hooks/useForm';
import { digitsOnly } from '@/core/utils/format';
import {
  email as emailRule,
  phone as phoneRule,
  required,
} from '@/core/utils/validation';
import { buildTeamInvite, buildWhatsAppUrl } from '@/core/utils/whatsapp';
import {
  ASSIGNABLE_BUSINESS_ROLE_OPTIONS,
  type AssignableBusinessRole,
  BUSINESS_ROLE_LABEL,
} from '@/domain/constants';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  OptionPicker,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

type InviteMethod = 'email' | 'whatsapp';

export const InviteMemberScreen = () => {
  const { activeBusiness, activeBusinessId } = useBusinesses();
  const dialog = useDialog();

  const [method, setMethod] = useState<InviteMethod>('email');

  /** Diálogo final con el código, como respaldo si el correo/WhatsApp no llega. */
  const showCodeDialog = (sentTo: string | null, code: string) => {
    dialog.show({
      tone: 'success',
      title: 'Invitación lista',
      message: sentTo
        ? `Le enviamos un correo a ${sentTo}. Si no le llega, compártele este código para unirse: ${code}`
        : `Comparte este código para que se una: ${code}`,
      confirmLabel: 'Listo',
      onConfirm: () => router.back(),
    });
  };

  /** Abre WhatsApp con la invitación; si no se puede, muestra el código. */
  const openWhatsApp = async (phone: string, roleLabel: string, code: string) => {
    const url = buildWhatsAppUrl(
      phone,
      buildTeamInvite({ businessName: activeBusiness?.name, roleLabel, code }),
    );
    if (url) {
      try {
        haptics.tap();
        await Linking.openURL(url);
        router.back();
        return;
      } catch {
        // Si no se pudo abrir WhatsApp, se cae al código para compartirlo a mano.
      }
    }
    showCodeDialog(null, code);
  };

  const form = useForm({
    initialValues: {
      email: '',
      phone: '',
      role: 'CASHIER' as AssignableBusinessRole,
    },
    // Reglas según el método: solo se valida el campo del método activo, el
    // otro queda sin regla y nunca bloquea el envío. `useForm` lee las reglas
    // frescas en cada envío, así que cambiar de método cambia la validación.
    rules:
      method === 'email'
        ? { email: [required('El correo'), emailRule] }
        : { phone: [required('El celular'), phoneRule] },
    onSubmit: async (values) => {
      if (!activeBusinessId) {
        dialog.show({
          tone: 'warning',
          title: 'Sin negocio seleccionado',
          message: 'Selecciona un negocio antes de invitar a alguien.',
        });
        return;
      }

      const roleLabel = BUSINESS_ROLE_LABEL[values.role];

      try {
        if (method === 'email') {
          const share = await invitationApi.create(activeBusinessId, {
            email: values.email.trim(),
            role: values.role,
          });
          showCodeDialog(values.email.trim(), share.invitation.code);
          return;
        }

        // WhatsApp: se crea la invitación con el teléfono y se abre el chat.
        const share = await invitationApi.create(activeBusinessId, {
          phone: digitsOnly(values.phone),
          role: values.role,
        });
        await openWhatsApp(values.phone, roleLabel, share.invitation.code);
      } catch (caught) {
        const error = toAppError(caught);

        // Ya había una pendiente para ese contacto: se ofrece reenviarla.
        const pendingId = error.payload?.invitationId;
        if (error.reason === 'INVITATION_ALREADY_PENDING' && typeof pendingId === 'string') {
          dialog.confirm({
            tone: 'info',
            title: 'Ya tiene una invitación',
            message:
              'Todavía no la ha aceptado. Puedes reenviarla: vuelve a quedar vigente 7 días con el mismo código.',
            confirmLabel: 'Reenviar',
            cancelLabel: 'Volver',
            onConfirm: async () => {
              try {
                const share = await invitationApi.resend(activeBusinessId, pendingId);
                if (method === 'email') {
                  showCodeDialog(values.email.trim(), share.invitation.code);
                } else {
                  await openWhatsApp(values.phone, roleLabel, share.invitation.code);
                }
              } catch (resendError) {
                dialog.showError(toAppError(resendError));
              }
            },
          });
          return;
        }

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        if (error.code === 'CONFLICT') {
          form.setFieldError(
            method === 'email' ? 'email' : 'phone',
            error.message || 'Esta persona ya es miembro del negocio',
          );
          return;
        }
        dialog.showError(error);
      }
    },
  });

  const isWhatsApp = method === 'whatsapp';

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label={isWhatsApp ? 'Invitar por WhatsApp' : 'Enviar invitación'}
          icon={isWhatsApp ? 'logo-whatsapp' : 'mail-outline'}
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <IconBubble icon="person-add" tone="brand" size={56} />
      <Text variant="title1" style={styles.title}>
        Invitar al equipo
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        {activeBusiness
          ? `Dale acceso a ${activeBusiness.name} a alguien de confianza.`
          : 'Dale acceso a tu negocio a alguien de confianza.'}
      </Text>

      <SegmentedControl<InviteMethod>
        value={method}
        onChange={setMethod}
        options={[
          { value: 'email', label: 'Correo' },
          { value: 'whatsapp', label: 'WhatsApp' },
        ]}
      />

      {isWhatsApp ? (
        <TextField
          label="Celular"
          placeholder="300 123 4567"
          icon="logo-whatsapp"
          value={form.values.phone}
          onChangeText={form.handleChange('phone')}
          onBlur={form.handleBlur('phone')}
          error={form.visibleError('phone')}
          keyboardType="phone-pad"
          helper="Le abriremos WhatsApp con la invitación y el código listos"
          returnKeyType="done"
          onSubmitEditing={form.submit}
        />
      ) : (
        <TextField
          label="Correo de la persona"
          placeholder="cajero@correo.com"
          icon="mail-outline"
          value={form.values.email}
          onChangeText={form.handleChange('email')}
          onBlur={form.handleBlur('email')}
          error={form.visibleError('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={form.submit}
        />
      )}

      <OptionPicker
        label="Rol"
        value={form.values.role}
        options={ASSIGNABLE_BUSINESS_ROLE_OPTIONS}
        onChange={(value) => form.setValue('role', value)}
        sheetTitle="¿Qué podrá hacer?"
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
  },
});
