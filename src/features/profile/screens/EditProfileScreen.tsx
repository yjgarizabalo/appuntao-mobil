/**
 * Edición del perfil.
 *
 * Guarda con `PATCH /users/:id` y sincroniza la copia local del usuario, para
 * que el saludo del inicio y el perfil se actualicen sin volver a entrar.
 *
 * El backend restringió qué puede tocar una cuenta de sí misma: solo
 * **nombre y apellido**. El correo, el celular y el documento los cambia un
 * administrador, y enviarlos responde 403. Por eso ya no son campos de
 * formulario: se muestran como datos, en una tarjeta de solo lectura con la
 * vía para corregirlos. Mostrar un input que siempre falla al guardar es peor
 * que no mostrarlo.
 *
 * El botón de guardar solo se habilita si algo cambió (`isDirty`): evita
 * peticiones inútiles y deja claro que no hay nada que guardar.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { useForm } from '@/core/hooks/useForm';
import { formatPhone } from '@/core/utils/format';
import { minLength, required } from '@/core/utils/validation';
import { DOCUMENT_TYPE_LABEL, isDocumentType } from '@/domain/constants';
import { authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  AppBar,
  Button,
  Card,
  Dialog,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  TextField,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';

const PLACEHOLDER = 'Sin registrar';

export const EditProfileScreen = () => {
  const { user, patchUser } = useSession();
  const dialog = useDialog();
  const toast = useToast();

  const form = useForm({
    initialValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    },
    rules: {
      firstName: [required('El nombre'), minLength(2, 'El nombre')],
      lastName: [required('El apellido'), minLength(2, 'El apellido')],
    },
    onSubmit: async (values) => {
      if (!user?.id) return;

      try {
        // Solo lo que el backend acepta de una cuenta sobre sí misma. Enviar
        // correo, teléfono, documento o rol daría 403.
        const payload = {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
        };

        await authApi.updateProfile(user.id, payload);
        await patchUser(payload);

        toast.success('Perfil actualizado');
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

  const documentLabel =
    user?.documentType && isDocumentType(user.documentType)
      ? DOCUMENT_TYPE_LABEL[user.documentType]
      : 'Documento';

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
          disabled={!form.isDirty}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Editar perfil" />

      <Text variant="body" color="textMuted" style={styles.intro}>
        Estos datos identifican tu cuenta. Tus clientes no los ven.
      </Text>

      <SectionHeader title="Nombre" />

      <View style={styles.row}>
        <TextField
          label="Nombre"
          value={form.values.firstName}
          onChangeText={form.handleChange('firstName')}
          onBlur={form.handleBlur('firstName')}
          error={form.visibleError('firstName')}
          autoCapitalize="words"
          containerStyle={styles.rowItem}
        />
        <TextField
          label="Apellido"
          value={form.values.lastName}
          onChangeText={form.handleChange('lastName')}
          onBlur={form.handleBlur('lastName')}
          error={form.visibleError('lastName')}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={form.submit}
          containerStyle={styles.rowItem}
        />
      </View>

      <SectionHeader title="Datos de tu cuenta" />

      <Card padding="none" style={styles.readOnlyCard}>
        <ListRow
          appearance="plain"
          title={user?.email || PLACEHOLDER}
          subtitle="Correo electrónico"
        />
        <Divider inset />
        <ListRow
          appearance="plain"
          title={user?.phone ? formatPhone(user.phone) : PLACEHOLDER}
          subtitle="Celular"
        />
        <Divider inset />
        <ListRow
          appearance="plain"
          title={user?.documentNumber || PLACEHOLDER}
          subtitle={documentLabel}
        />
      </Card>

      <Text variant="caption" color="textMuted" style={styles.readOnlyNote}>
        Por seguridad, el correo, el celular y el documento solo los puede
        cambiar un administrador. Si alguno está mal, escríbenos a soporte.
      </Text>

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  intro: {
    marginTop: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  readOnlyCard: {
    backgroundColor: theme.color.surfaceMuted,
  },
  readOnlyNote: {
    marginTop: theme.spacing.sm,
  },
});
