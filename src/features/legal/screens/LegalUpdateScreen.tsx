/**
 * "Actualizamos nuestros documentos": aceptación de una versión nueva.
 *
 * La muestra `LegalGate` cuando el backend dice que el usuario tiene
 * documentos vigentes sin aceptar (`GET /legal/pending`), típicamente porque
 * se publicó una versión nueva después de que creó su cuenta. La autorización
 * de tratamiento de datos tiene que cubrir el texto que rige hoy, así que no
 * se sigue usando la app sin aceptarla; la salida es cerrar sesión.
 *
 * Si mientras tanto se publica otra versión, el backend rechaza la aceptación:
 * se vuelven a pedir los pendientes, se desmarca la casilla y se avisa.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { joinLegalTitles, type LegalDocument } from '@/domain/legal';
import { useSession } from '@/features/auth/session/SessionProvider';
import { legalApi } from '@/features/legal/api/legalApi';
import { LegalAcceptance } from '@/features/legal/components/LegalAcceptance';
import { Button, Dialog, Screen, Text, useDialog } from '@/ui';
import { theme } from '@/theme';

export interface LegalUpdateScreenProps {
  documents: LegalDocument[];
  /** Lo que quedó pendiente tras aceptar (vacío = puede seguir). */
  onDone: (remaining: LegalDocument[]) => void;
}

export const LegalUpdateScreen = ({ documents, onDone }: LegalUpdateScreenProps) => {
  const { logout } = useSession();
  const dialog = useDialog();

  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (value: boolean) => {
    setAccepted(value);
    if (value) setError(undefined);
  };

  const submit = async () => {
    if (!accepted) {
      setError('Debes aceptar los documentos para seguir usando Appuntao');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    try {
      const remaining = await legalApi.accept(documents.map((doc) => doc.id));
      haptics.success();
      onDone(remaining);
    } catch (caught) {
      const failure = toAppError(caught);

      if (failure.code === 'VALIDATION') {
        // Lo más probable: se publicó otra versión mientras leía.
        const fresh = await legalApi.pending().catch(() => null);
        if (fresh) {
          setAccepted(false);
          setError(
            fresh.length
              ? 'Hay una versión más reciente. Léela y vuelve a aceptarla.'
              : undefined,
          );
          onDone(fresh);
          return;
        }
      }

      dialog.showError(failure);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      scroll
      padded
      footer={
        <View style={styles.footer}>
          <Button
            label="Aceptar y continuar"
            onPress={submit}
            loading={isSubmitting}
            size="lg"
            fullWidth
          />
          <Button
            label="Cerrar sesión"
            onPress={() => void logout()}
            variant="ghost"
            disabled={isSubmitting}
            fullWidth
          />
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={28} color={theme.color.brandStrong} />
        </View>
        <Text variant="title1">Actualizamos nuestros documentos</Text>
        <Text variant="body" color="textMuted">
          Para seguir usando Appuntao necesitamos que leas y aceptes la versión vigente. Tus
          datos y tus cuentas siguen igual.
        </Text>
      </View>

      <LegalAcceptance
        documents={documents}
        accepted={accepted}
        onChange={handleChange}
        statement={`He leído y acepto la versión vigente de ${joinLegalTitles(documents)} de Appuntao.`}
        error={error}
        helper="Necesario para seguir usando Appuntao."
      />

      <Dialog {...dialog.props} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing['2xl'],
  },
  icon: {
    width: theme.spacing['3xl'],
    height: theme.spacing['3xl'],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  footer: {
    gap: theme.spacing.xs,
  },
});
