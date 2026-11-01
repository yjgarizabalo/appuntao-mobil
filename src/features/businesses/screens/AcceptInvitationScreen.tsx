/**
 * Canjear un código de invitación.
 *
 * Es la contraparte de "Invitar": la persona que recibió el correo (o el código
 * a mano) lo teclea aquí. Se eligió el código dentro de la app en vez de un
 * deep link porque es lo que el backend ya soporta sin cambios y funciona en
 * Expo Go (un deep link `https` exigiría un dev build).
 *
 * Una sola pantalla atiende los **dos** tipos de invitación que emite el
 * backend, porque para quien lo recibe un código es un código y no tiene por
 * qué saber de qué clase es:
 *
 *  - `BUSINESS_USER` → entra al equipo del negocio con un rol y queda en modo
 *    tendero;
 *  - `DEBTOR` → vincula su cuenta a la ficha de cliente que la tienda ya tenía
 *    (`Debtor.userId`) y queda en modo cliente, viendo lo que debe.
 *
 * El flujo valida el código con `GET /invitations/:code` para poder explicar
 * qué va a pasar antes de confirmar, y solo entonces lo acepta.
 */
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { routes } from '@/core/navigation/routes';
import { required } from '@/core/utils/validation';
import { BUSINESS_ROLE_LABEL } from '@/domain/constants';
import { invitationApi } from '@/features/businesses/api/invitationApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { useAppMode } from '@/features/client/state/AppModeProvider';
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

export const AcceptInvitationScreen = () => {
  const { refresh: refreshBusinesses, selectBusiness } = useBusinesses();
  const { setMode, refreshAccounts } = useAppMode();
  const dialog = useDialog();
  const toast = useToast();

  /** `BUSINESS_USER`: el usuario entra al equipo y sigue como tendero. */
  const joinTeam = async (code: string, businessId: string | null) => {
    try {
      await invitationApi.accept(code);
      await refreshBusinesses();
      // El negocio recién aceptado pasa a ser el activo, que es a donde el
      // usuario quiere entrar.
      if (businessId) selectBusiness(businessId);
      toast.success('¡Ya eres parte del equipo!');
      router.replace(routes.tabs.businesses);
    } catch (caught) {
      dialog.showError(toAppError(caught));
    }
  };

  /**
   * `DEBTOR`: el usuario queda vinculado a la ficha que la tienda ya tenía y
   * se le deja directamente en el modo cliente. Cambiar de modo aquí no es
   * presuntuoso: acaba de pedir explícitamente ver su cuenta en esa tienda.
   */
  const linkAsClient = async (code: string) => {
    try {
      await invitationApi.accept(code);
      await refreshAccounts();
      setMode('client');
      toast.success('¡Listo! Ya puedes ver tu cuenta en esa tienda.');
      router.replace(routes.clientMode.wallet);
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
      const code = values.code.trim().toLowerCase();
      try {
        const invitation = await invitationApi.getByCode(code);

        if (invitation.type === 'DEBTOR') {
          dialog.confirm({
            tone: 'info',
            title: '¿Vincularte a esta tienda?',
            message:
              'Vas a ver lo que debes y tu historial de abonos. La tienda sigue siendo quien registra los vales y los pagos.',
            confirmLabel: 'Vincularme',
            onConfirm: () => void linkAsClient(invitation.code),
          });
          return;
        }

        const roleLabel = invitation.role ? BUSINESS_ROLE_LABEL[invitation.role] : 'miembro';
        dialog.confirm({
          tone: 'info',
          title: '¿Unirte al negocio?',
          message: `Entrarás como ${roleLabel}. Podrás empezar a trabajar de una vez.`,
          confirmLabel: 'Unirme',
          onConfirm: () => void joinTeam(invitation.code, invitation.businessId ?? null),
        });
      } catch (caught) {
        const error = toAppError(caught);

        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        // Código inexistente, ya usado o expirado: el backend manda un mensaje
        // claro en español, así que se muestra junto al campo.
        if (
          error.code === 'NOT_FOUND' ||
          error.code === 'VALIDATION' ||
          error.code === 'CONFLICT'
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
        Tengo un código
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Escribe el código que te compartieron para unirte a un negocio o para vincularte a
        una tienda donde te fían.
      </Text>

      <TextField
        label="Código de invitación"
        placeholder="a1b2c3"
        icon="key-outline"
        value={form.values.code}
        onChangeText={form.handleChange('code')}
        onBlur={form.handleBlur('code')}
        error={form.visibleError('code')}
        autoCapitalize="none"
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
