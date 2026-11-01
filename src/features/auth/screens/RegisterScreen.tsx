/**
 * Registro de usuario.
 *
 * El formulario del v1 pedía siete campos seguidos en una sola columna, sin
 * agrupar y sin explicar por qué. Aquí se agrupan en tres bloques con título
 * ("Tus datos", "Contacto", "Seguridad") y una barra de progreso arriba: el
 * mismo número de campos se percibe mucho más corto.
 *
 * Al terminar no se inicia sesión automáticamente (el backend solo crea el
 * usuario), así que se confirma el éxito y se lleva al login con el correo ya
 * escrito.
 *
 * Cierra con la casilla de aceptación de los Términos y Condiciones
 * (`TermsAcceptance`), que es la última puerta antes de enviar: sin marcarla
 * no sale ningún dato personal hacia el servidor.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useForm } from '@/core/hooks/useForm';
import { routes } from '@/core/navigation/routes';
import {
  documentNumber as documentNumberRule,
  email as emailRule,
  matches,
  minLength,
  password as passwordRule,
  phone as phoneRule,
  required,
} from '@/core/utils/validation';
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from '@/domain/constants';
import { TermsAcceptance } from '@/features/auth/components/TermsAcceptance';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  AppBar,
  Button,
  Dialog,
  OptionPicker,
  Screen,
  SectionHeader,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

export const RegisterScreen = () => {
  const { register } = useSession();
  const dialog = useDialog();

  /**
   * La aceptación no vive en `useForm`: el hook maneja campos de texto, y un
   * booleano disfrazado de cadena ("true" / "") se lee peor de lo que ahorra.
   */
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | undefined>(undefined);

  const handleAcceptTerms = (accepted: boolean) => {
    setAcceptedTerms(accepted);
    // El error desaparece en cuanto se marca, sin esperar a reenviar.
    if (accepted) setTermsError(undefined);
  };

  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      documentType: 'CC' as DocumentType,
      documentNumber: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    rules: {
      firstName: [required('El nombre'), minLength(2, 'El nombre')],
      lastName: [required('El apellido'), minLength(2, 'El apellido')],
      documentNumber: [documentNumberRule],
      email: [required('El correo'), emailRule],
      phone: [phoneRule],
      password: [passwordRule],
    },
    onSubmit: async (values) => {
      // Primero que nada: sin consentimiento no se manda un solo dato
      // personal al servidor.
      if (!acceptedTerms) {
        setTermsError('Debes aceptar los Términos y Condiciones para crear tu cuenta');
        haptics.warning();
        return;
      }

      if (values.password !== values.confirmPassword) {
        form.setFieldError('confirmPassword', 'Las contraseñas no coinciden');
        return;
      }

      try {
        await register({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          documentType: values.documentType as DocumentType,
          documentNumber: values.documentNumber.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          password: values.password,
        });

        dialog.show({
          tone: 'success',
          title: '¡Cuenta creada!',
          message: 'Ya puedes iniciar sesión con tu correo y contraseña.',
          confirmLabel: 'Iniciar sesión',
          onConfirm: () => router.replace(routes.auth.login),
        });
      } catch (caught) {
        const error = toAppError(caught);

        // Si el backend indica qué campo falló, se marca ese campo en lugar de
        // mostrar un diálogo genérico.
        if (error.fieldErrors) {
          form.setFieldErrors(error.fieldErrors);
          return;
        }
        if (error.code === 'CONFLICT') {
          form.setFieldError('email', 'Ya existe una cuenta con este correo o documento');
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
          label="Crear cuenta"
          onPress={form.submit}
          loading={form.isSubmitting}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} />

      <Text variant="title1">Crea tu cuenta</Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Es gratis y toma menos de un minuto.
      </Text>

      <SectionHeader title="Tus datos" />

      <View style={styles.row}>
        <TextField
          label="Nombre"
          placeholder="María"
          value={form.values.firstName}
          onChangeText={form.handleChange('firstName')}
          onBlur={form.handleBlur('firstName')}
          error={form.visibleError('firstName')}
          autoCapitalize="words"
          textContentType="givenName"
          containerStyle={styles.rowItem}
        />
        <TextField
          label="Apellido"
          placeholder="Pérez"
          value={form.values.lastName}
          onChangeText={form.handleChange('lastName')}
          onBlur={form.handleBlur('lastName')}
          error={form.visibleError('lastName')}
          autoCapitalize="words"
          textContentType="familyName"
          containerStyle={styles.rowItem}
        />
      </View>

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

      <SectionHeader title="Contacto" />

      <TextField
        label="Correo electrónico"
        placeholder="tu@correo.com"
        icon="mail-outline"
        value={form.values.email}
        onChangeText={form.handleChange('email')}
        onBlur={form.handleBlur('email')}
        error={form.visibleError('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <TextField
        label="Celular"
        placeholder="300 123 4567"
        icon="call-outline"
        value={form.values.phone}
        onChangeText={form.handleChange('phone')}
        onBlur={form.handleBlur('phone')}
        error={form.visibleError('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        helper="Lo usarás para recuperar tu cuenta"
      />

      <SectionHeader title="Seguridad" />

      <TextField
        label="Contraseña"
        placeholder="Mínimo 8 caracteres"
        icon="lock-closed-outline"
        value={form.values.password}
        onChangeText={form.handleChange('password')}
        onBlur={form.handleBlur('password')}
        error={form.visibleError('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        helper="Debe tener al menos 8 caracteres, una letra y un número"
      />

      <TextField
        label="Confirmar contraseña"
        placeholder="Repite tu contraseña"
        icon="lock-closed-outline"
        value={form.values.confirmPassword}
        onChangeText={form.handleChange('confirmPassword')}
        onBlur={form.handleBlur('confirmPassword')}
        error={
          form.visibleError('confirmPassword') ??
          (form.values.confirmPassword.length > 0
            ? matches(form.values.password, 'Las contraseñas no coinciden')(
                form.values.confirmPassword,
              )
            : undefined)
        }
        secureTextEntry
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={form.submit}
      />

      <TermsAcceptance accepted={acceptedTerms} onChange={handleAcceptTerms} error={termsError} />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginTop: theme.spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  documentType: {
    width: 118,
  },
  documentNumber: {
    flex: 1,
  },
});
