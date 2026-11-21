/**
 * Invitar a un cliente a ver su cuenta en Appuntao (invitación `DEBTOR`).
 *
 * Es la **única** forma de que un cliente vea en el modo cliente lo que debe:
 * el backend ya no vincula cuentas solas por documento o teléfono, porque eso
 * dejaba que cualquier negocio "reclamara" a una persona registrando su
 * número.
 *
 * La invitación va a un celular o a un correo, y solo la puede aceptar quien
 * tenga ese dato en su cuenta:
 *
 *  - **WhatsApp** (lo normal): se precarga el celular de la ficha y se abre
 *    WhatsApp con el mensaje del backend. Si la persona ya tiene cuenta con
 *    ese número, la invitación le aparece al abrir la app; si no, al
 *    registrarse con él.
 *  - **Correo**: para cuando su cuenta está con otro número. El backend envía
 *    el correo.
 *
 * Si ya había una pendiente, se ofrece reenviarla (renueva la vigencia, el
 * código no cambia) en vez de dejar un error sin salida.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { digitsOnly } from '@/core/utils/format';
import { email as emailRule, phone as phoneRule, required } from '@/core/utils/validation';
import type { InvitationShare } from '@/domain/models';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { shareInvitation } from '@/features/businesses/model/invitationFlow';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

type InviteMethod = 'whatsapp' | 'email';

export const InviteClientScreen = () => {
  const params = useLocalSearchParams<{
    id?: string;
    businessId?: string;
    name?: string;
    phone?: string;
  }>();
  const debtorId = params.id ?? '';
  const businessId = params.businessId ?? '';
  const debtorName = params.name ?? 'tu cliente';
  const firstName = debtorName.split(' ')[0];
  const dialog = useDialog();

  const [method, setMethod] = useState<InviteMethod>('whatsapp');
  const [isResending, setIsResending] = useState(false);

  /** Código de respaldo, si no se pudo abrir WhatsApp o el correo no salió. */
  const showCode = (share: InvitationShare, intro: string) =>
    dialog.show({
      tone: 'success',
      title: 'Invitación lista',
      message: `${intro} Si no le llega, compártele este código: ${share.invitation.code}. Lo escribe en "Tengo un código".`,
      confirmLabel: 'Listo',
      onConfirm: () => router.back(),
    });

  /** Después de crear o reenviar: WhatsApp o el aviso del correo. */
  const deliver = async (share: InvitationShare, sentByEmail: boolean) => {
    if (sentByEmail) {
      showCode(
        share,
        share.emailSent
          ? `Le enviamos un correo a ${share.invitation.email}.`
          : 'No pudimos enviar el correo.',
      );
      return;
    }
    if (await shareInvitation(share)) {
      router.back();
      return;
    }
    showCode(share, 'No pudimos abrir WhatsApp.');
  };

  const offerResend = (invitationId: string, sentByEmail: boolean) =>
    dialog.confirm({
      tone: 'info',
      title: `${firstName} ya tiene una invitación`,
      message:
        'Todavía no la ha aceptado. Puedes reenviarla: vuelve a quedar vigente 7 días con el mismo código.',
      confirmLabel: 'Reenviar',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setIsResending(true);
        try {
          const share = await invitationApi.resend(businessId, invitationId);
          await deliver(share, sentByEmail);
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          setIsResending(false);
        }
      },
    });

  const form = useForm({
    initialValues: { phone: params.phone ?? '', email: '' },
    rules:
      method === 'email'
        ? { email: [required('El correo'), emailRule] }
        : { phone: [required('El celular'), phoneRule] },
    onSubmit: async (values) => {
      const sentByEmail = method === 'email';
      try {
        const share = await invitationApi.inviteClient(businessId, {
          debtorId,
          ...(sentByEmail
            ? { email: values.email.trim() }
            : { phone: digitsOnly(values.phone) }),
        });
        await deliver(share, sentByEmail);
      } catch (caught) {
        const error = toAppError(caught);
        const pendingId = error.payload?.invitationId;
        if (error.reason === 'INVITATION_ALREADY_PENDING' && typeof pendingId === 'string') {
          offerResend(pendingId, sentByEmail);
          return;
        }
        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
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
          loading={form.isSubmitting || isResending}
          disabled={!debtorId || !businessId}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <IconBubble icon="wallet-outline" tone="brand" size={56} />
      <Text variant="title1" style={styles.title}>
        Invitar a ver su cuenta
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        {`${firstName} podrá ver en Appuntao lo que te debe y sus abonos. Solo lo ve: los vales y los pagos los sigues registrando tú.`}
      </Text>

      <SegmentedControl<InviteMethod>
        value={method}
        onChange={setMethod}
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'email', label: 'Correo' },
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
          helper="El de su cuenta en Appuntao. Si todavía no tiene, que se registre con este número."
          returnKeyType="done"
          onSubmitEditing={form.submit}
        />
      ) : (
        <TextField
          label="Correo de su cuenta"
          placeholder="cliente@correo.com"
          icon="mail-outline"
          value={form.values.email}
          onChangeText={form.handleChange('email')}
          onBlur={form.handleBlur('email')}
          error={form.visibleError('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          helper="Útil si su cuenta está con otro celular."
          returnKeyType="done"
          onSubmitEditing={form.submit}
        />
      )}

      <Dialog {...dialog.props} loading={isResending} />
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
