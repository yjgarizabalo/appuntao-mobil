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
 * Cierra con la casilla de aceptación de los documentos legales
 * (`LegalAcceptance`), que es la última puerta antes de enviar: sin marcarla
 * no sale ningún dato personal hacia el servidor.
 *
 * Los documentos se piden al backend al abrir la pantalla (`GET /legal/current?audience=ALL_USERS`)
 * y sus ids viajan en el registro como prueba de qué versión se aceptó. Dos
 * casos que el formulario resuelve solo:
 *  - **los documentos no cargan o no hay publicados**: el botón "Crear cuenta"
 *    queda deshabilitado y la tarjeta dice por qué, antes de que el usuario
 *    llene nada en vano (el backend respondería 503);
 *  - **se publicó una versión nueva mientras llenaba el formulario**: el
 *    backend rechaza los ids viejos; se recargan los documentos, se desmarca la
 *    casilla y se le pide aceptar otra vez, sin perder lo que escribió.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
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
import { joinLegalTitles, type LegalDocument } from '@/domain/legal';
import { useSession } from '@/features/auth/session/SessionProvider';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalAcceptance } from '@/features/legal/components/LegalAcceptance';
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
  const legal = useAsyncData(legalApi.forRegistration);

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
      const documents = legal.data;
      if (!documents?.length) {
        setTermsError(
          documents
            ? 'No es posible crear cuentas en este momento.'
            : 'Necesitamos cargar los documentos legales antes de crear tu cuenta.',
        );
        haptics.warning();
        void legal.reload();
        return;
      }

      if (!acceptedTerms) {
        setTermsError('Debes aceptar los documentos legales para crear tu cuenta');
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
          acceptedLegalDocumentIds: documents.map((doc) => doc.id),
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

        // ¿Cambiaron los documentos mientras llenaba el formulario? Se
        // comprueba contra el backend en vez de leer el mensaje del error, que
        // es texto para personas y puede cambiar.
        if (error.code === 'VALIDATION' || error.status === 503) {
          const fresh = await legalApi.forRegistration().catch(() => null);
          if (fresh && !sameDocuments(fresh, documents)) {
            legal.setData(fresh);
            setAcceptedTerms(false);
            setTermsError(
              fresh.length
                ? 'Actualizamos nuestros documentos legales. Léelos y vuelve a aceptarlos.'
                : 'No es posible crear cuentas en este momento.',
            );
            haptics.warning();
            return;
          }
        }

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
        // Sin documentos cargados (cargando, error o sin publicar) no hay nada
        // que aceptar, así que no se puede crear la cuenta. La tarjeta legal
        // explica por qué y ofrece reintentar.
        <Button
          label="Crear cuenta"
          onPress={form.submit}
          loading={form.isSubmitting}
          disabled={!legal.data?.length}
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

      <LegalAcceptance
        documents={legal.data}
        isLoading={legal.isLoading}
        loadError={legal.error}
        onRetry={legal.reload}
        accepted={acceptedTerms}
        onChange={handleAcceptTerms}
        // "Autorizo" y no solo "acepto": la Ley 1581 pide una autorización
        // previa, expresa e informada para tratar los datos personales.
        statement={`He leído y acepto ${joinLegalTitles(legal.data ?? [])} de Appuntao, y autorizo el tratamiento de mis datos personales en los términos de esos documentos.`}
        error={termsError}
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

/** Mismos documentos y mismas versiones (los ids cambian con cada versión). */
const sameDocuments = (a: LegalDocument[], b: LegalDocument[]): boolean =>
  a.length === b.length && a.every((doc) => b.some((other) => other.id === doc.id));

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
