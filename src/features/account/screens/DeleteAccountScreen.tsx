/**
 * Eliminar la cuenta propia.
 *
 * Es el derecho de supresión de la Ley 1581 y lo que exigen App Store y Google
 * Play a toda app que permite crear cuentas. No es inmediato a propósito:
 *
 *  1. Se muestra qué va a pasar (`GET /users/me/deletion-preview`): el plazo
 *     de gracia y los negocios de los que es dueño, con sus clientes y lo que
 *     le deben. Un dueño puede pasarle el negocio a un miembro antes de irse.
 *  2. Se confirma con la contraseña y, si tiene negocios, aceptando que se
 *     cerrarán.
 *  3. La cuenta queda desactivada en ese momento y el backend cierra todas las
 *     sesiones. Se elimina al terminar el plazo; hasta entonces basta iniciar
 *     sesión para arrepentirse (ver `LoginScreen`).
 *
 * Por eso, al terminar, no se llama al logout: el servidor ya invalidó la
 * sesión y solo queda limpiar el dispositivo (`endSession`).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toAppError } from '@/core/errors/AppError';
import { haptics } from '@/core/haptics';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { routes } from '@/core/navigation/routes';
import { formatLongDate, formatMoney, pluralize } from '@/core/utils/format';
import type { OwnedBusinessSummary } from '@/domain/models';
import { accountApi } from '@/features/account/api/accountApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import {
  AppBar,
  Button,
  Card,
  CheckboxField,
  Dialog,
  ErrorState,
  IconBubble,
  Screen,
  Skeleton,
  Text,
  TextField,
  useDialog,
} from '@/ui';
import { theme } from '@/theme';

export const DeleteAccountScreen = () => {
  const { endSession } = useSession();
  const dialog = useDialog();
  const preview = useAsyncData(accountApi.deletionPreview);

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackError, setAckError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const owned = preview.data?.ownedBusinesses ?? [];
  const graceDays = preview.data?.gracePeriodDays ?? 15;

  const submit = async () => {
    if (!password) {
      setPasswordError('Escribe tu contraseña para confirmar');
      return;
    }
    if (owned.length && !acknowledged) {
      setAckError('Confirma que entiendes qué pasará con tus negocios');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await accountApi.requestDeletion({
        password,
        acknowledgeBusinessClosure: owned.length ? true : undefined,
      });
      const when = formatLongDate(result.deletionScheduledAt);
      dialog.show({
        tone: 'info',
        title: 'Tu cuenta se eliminará',
        message: `${when ? `Se eliminará el ${when}. ` : ''}Si cambias de opinión antes, inicia sesión y elige conservarla.`,
        confirmLabel: 'Entendido',
        // La sesión ya no vale en el servidor: solo queda limpiar el teléfono.
        // La guardia de `(app)` lleva al login sola.
        onConfirm: () => {
          void endSession();
        },
      });
    } catch (caught) {
      const error = toAppError(caught);
      // Aparecieron negocios que no estaban al abrir la pantalla.
      if (error.reason === 'BUSINESS_CLOSURE_ACK_REQUIRED') {
        setAcknowledged(false);
        setAckError('Tienes negocios activos. Revísalos y confirma antes de seguir.');
        void preview.reload();
        return;
      }
      if (error.code === 'VALIDATION' && error.message) {
        setPasswordError(error.message);
        return;
      }
      dialog.showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAndSubmit = () =>
    dialog.confirm({
      tone: 'danger',
      title: '¿Eliminar tu cuenta?',
      message: `Tu cuenta quedará desactivada ahora y se eliminará en ${pluralize(graceDays, 'día')}.`,
      confirmLabel: 'Eliminar mi cuenta',
      onConfirm: () => {
        void submit();
      },
    });

  return (
    <Screen
      scroll
      padded
      keyboardAware
      footer={
        <Button
          label="Eliminar mi cuenta"
          variant="danger"
          onPress={confirmAndSubmit}
          loading={isSubmitting}
          disabled={!preview.data || !password || (owned.length > 0 && !acknowledged)}
          size="lg"
          fullWidth
        />
      }
    >
      <AppBar onBack={() => router.back()} title="Eliminar cuenta" />

      <IconBubble icon="trash-outline" tone="danger" size={56} />

      <Text variant="title2" style={styles.title}>
        Eliminar tu cuenta
      </Text>
      <Text variant="body" color="textMuted" style={styles.subtitle}>
        Tu cuenta quedará desactivada de inmediato y se eliminará definitivamente en{' '}
        {pluralize(graceDays, 'día')}. Si cambias de opinión antes, solo tienes que iniciar
        sesión.
      </Text>

      <Card padding="lg" style={styles.card}>
        <Bullet icon="person-remove-outline">
          Se borran tus datos personales: nombre, correo, celular y documento.
        </Bullet>
        <Bullet icon="receipt-outline">
          Si eres cliente de alguna tienda, la tienda conserva sus vales y abonos, pero ya no
          quedan ligados a tu cuenta.
        </Bullet>
        <Bullet icon="people-outline">Sales de los equipos de los que eres miembro.</Bullet>
      </Card>

      {/* La alternativa que no borra nada, para quien solo quiere una pausa. */}
      <Card padding="lg" style={styles.pauseCard}>
        <Text variant="bodyStrong">¿Solo quieres una pausa?</Text>
        <Text variant="caption" color="textMuted">
          Desactivar tu cuenta no borra nada y tus negocios siguen funcionando. Vuelves cuando
          quieras iniciando sesión.
        </Text>
        <Button
          label="Desactivarla en su lugar"
          variant="secondary"
          size="sm"
          onPress={() => router.replace(routes.settings.deactivateAccount)}
          style={styles.businessAction}
        />
      </Card>

      {preview.isLoading ? (
        <View style={styles.skeleton}>
          <Skeleton height={96} radius={theme.radius.lg} />
        </View>
      ) : preview.error ? (
        <ErrorState error={preview.error} onRetry={preview.reload} />
      ) : owned.length ? (
        <>
          <Text variant="overline" color="textSubtle" uppercase style={styles.groupLabel}>
            Tus negocios
          </Text>
          <Text variant="body" color="textMuted" style={styles.groupHelp}>
            Al eliminar tu cuenta se cierran y, más adelante, se borra su información. Si
            alguien de tu equipo va a seguir, pásale el negocio antes.
          </Text>

          {owned.map((business) => (
            <OwnedBusinessCard key={business.id} business={business} />
          ))}

          <CheckboxField
            checked={acknowledged}
            onChange={(value) => {
              setAcknowledged(value);
              if (value) setAckError(undefined);
            }}
            error={ackError}
            label="Entiendo que mis negocios se cerrarán y su información se eliminará."
            style={styles.ack}
          />
        </>
      ) : null}

      <TextField
        label="Tu contraseña"
        placeholder="Para confirmar que eres tú"
        icon="key-outline"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (value) setPasswordError(undefined);
        }}
        error={passwordError}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        containerStyle={styles.password}
      />

      <Dialog {...dialog.props} loading={isSubmitting} />
    </Screen>
  );
};

const Bullet = ({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: string;
}) => (
  <View style={styles.bullet}>
    <Ionicons name={icon} size={18} color={theme.color.textMuted} />
    <Text variant="body" style={styles.bulletText}>
      {children}
    </Text>
  </View>
);

const OwnedBusinessCard = ({ business }: { business: OwnedBusinessSummary }) => {
  const pendingTo = business.pendingTransfer
    ? business.transferCandidates.find(
        (candidate) => candidate.userId === business.pendingTransfer?.toUserId,
      )
    : undefined;

  return (
    <Card padding="lg" style={styles.businessCard}>
      <Text variant="bodyStrong">{business.name}</Text>
      <Text variant="caption" color="textMuted">
        {pluralize(business.debtorsCount, 'cliente')} · {formatMoney(business.pendingBalance)} por
        cobrar
      </Text>

      {business.pendingTransfer ? (
        <Text variant="caption" color="brandStrong" style={styles.businessNote}>
          Le propusiste el negocio a {pendingTo?.name ?? 'un miembro'}. Tiene hasta el{' '}
          {formatLongDate(business.pendingTransfer.expiresAt)} para aceptar.
        </Text>
      ) : business.transferCandidates.length ? (
        <Button
          label="Pasarle el negocio a alguien"
          variant="secondary"
          size="sm"
          onPress={() => router.push(routes.business.transfer(business.id))}
          style={styles.businessAction}
        />
      ) : (
        <Text variant="caption" color="textSubtle" style={styles.businessNote}>
          No tiene más miembros a quién pasárselo.
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  card: {
    gap: theme.spacing.md,
  },
  bullet: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  bulletText: {
    flex: 1,
  },
  pauseCard: {
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.md,
  },
  skeleton: {
    marginTop: theme.spacing.xl,
  },
  groupLabel: {
    marginTop: theme.spacing['2xl'],
  },
  groupHelp: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  businessCard: {
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.sm,
  },
  businessNote: {
    marginTop: theme.spacing.sm,
  },
  businessAction: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  ack: {
    marginTop: theme.spacing.md,
  },
  password: {
    marginTop: theme.spacing.xl,
  },
});
