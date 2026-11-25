/**
 * Canjear un código de invitación.
 *
 * Toda invitación se acepta aquí, con su código: desde "Tengo un código" o
 * desde "Aceptar" en la tarjeta de invitaciones recibidas (que pasa
 * `business` para decir de qué negocio es). El backend exige el código
 * porque el teléfono de una cuenta no se verifica: solo quien recibió el
 * WhatsApp o el correo del negocio lo tiene.
 *
 * Una sola pantalla atiende los **dos** tipos, porque para quien lo recibe un
 * código es un código:
 *
 *  - `BUSINESS_USER` → entra al equipo con un rol y queda en modo tendero;
 *  - `DEBTOR` → vincula su cuenta a la ficha de cliente que la tienda ya tenía
 *    y queda en modo cliente, viendo lo que debe.
 *
 * Primero se pide la vista previa (`GET /invitations/:code`) para explicar qué
 * va a pasar, y solo entonces se acepta **con el código que escribió**: la
 * vista previa no trae el código, porque el backend no se lo muestra a la
 * persona invitada.
 *
 * Solo la destinataria puede usarlo. Si la cuenta tiene otro teléfono o correo,
 * el backend responde 403 y se explica junto al campo.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { required } from '@/core/utils/validation';
import { BUSINESS_ROLE_LABEL } from '@/domain/constants';
import {
  invitationApi,
  normalizeInvitationCode,
} from '@/features/businesses/api/invitationApi';
import { useFinishAcceptedInvitation } from '@/features/businesses/model/invitationFlow';
import {
  AppBar,
  Button,
  Dialog,
  IconBubble,
  Screen,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

export const AcceptInvitationScreen = () => {
  const { business } = useLocalSearchParams<{ business?: string }>();
  const finish = useFinishAcceptedInvitation();
  const dialog = useDialog();

  const accept = async (code: string) => {
    try {
      const result = await invitationApi.acceptByCode(code);
      await finish(result);
    } catch (caught) {
      dialog.showError(toAppError(caught));
    }
  };

  const form = useForm({
    initialValues: { code: '' },
    rules: {
      code: [required('El código')],
    },
    onSubmit: async (values) => {
      const code = normalizeInvitationCode(values.code);
      try {
        const invitation = await invitationApi.getByCode(code);
        const business = invitation.businessName ?? 'este negocio';

        if (invitation.type === 'DEBTOR') {
          dialog.confirm({
            tone: 'info',
            title: `¿Ver tu cuenta en ${business}?`,
            message:
              'Vas a ver lo que debes y tu historial de abonos. La tienda sigue siendo quien registra los vales y los pagos.',
            confirmLabel: 'Ver mi cuenta',
            onConfirm: () => void accept(code),
          });
          return;
        }

        const roleLabel = invitation.role ? BUSINESS_ROLE_LABEL[invitation.role] : 'miembro';
        dialog.confirm({
          tone: 'info',
          title: `¿Unirte a ${business}?`,
          message: `Entrarás como ${roleLabel}. Podrás empezar a trabajar de una vez.`,
          confirmLabel: 'Unirme',
          onConfirm: () => void accept(code),
        });
      } catch (caught) {
        const error = toAppError(caught);

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        // Código inexistente, vencido, ya usado o para otra persona: el
        // backend manda un mensaje claro en español, así que va junto al campo.
        if (
          error.code === 'NOT_FOUND' ||
          error.code === 'VALIDATION' ||
          error.code === 'CONFLICT' ||
          error.code === 'FORBIDDEN'
        ) {
          form.setFieldError('code', error.message);
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
          label="Continuar"
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <IconBubble icon="ticket-outline" tone="brand" size={56} />
      <Text variant="title1" style={styles.title}>
        {business ? `Invitación de ${business}` : 'Tengo un código'}
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        {business
          ? `Escribe el código que ${business} te envió por WhatsApp o por correo. Así confirmamos que la invitación es para ti.`
          : 'Escribe el código que te compartieron para unirte a un negocio o para ver tu cuenta en una tienda donde te fían. Tiene que ser para el celular o el correo de tu cuenta.'}
      </Text>

      <TextField
        label="Código de invitación"
        placeholder="ABCD2345XY"
        icon="key-outline"
        value={form.values.code}
        onChangeText={form.handleChange('code')}
        onBlur={form.handleBlur('code')}
        error={form.visibleError('code')}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={form.submit}
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
