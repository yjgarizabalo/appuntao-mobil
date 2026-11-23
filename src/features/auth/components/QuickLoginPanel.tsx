/**
 * Panel del ingreso rápido: lo que ve en el login quien tiene sus datos
 * recordados en el teléfono.
 *
 * Saluda por el nombre y muestra el identificador **enmascarado** —el
 * teléfono puede estar a la vista de otros en el mostrador—, con una sola
 * acción principal: entrar con la huella, el rostro o el bloqueo del celular.
 * Debajo, las dos salidas que siempre tienen que existir: escribir la
 * contraseña (por si el sensor falla) y entrar con otra cuenta (el celular de
 * la tienda lo comparten dueño y cajero).
 *
 * Mantiene el ritmo del formulario de `LoginScreen` (título `title2`, botón
 * `lg`, pie "¿…? Acción") para que pasar de uno a otro no se sienta como
 * cambiar de pantalla.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DeviceAuthKind, deviceAuthLabel } from '@/core/device/deviceAuth';
import { maskIdentifier } from '@/core/utils/format';
import type { RememberedAccount } from '@/features/auth/model/rememberedLogin';
import { Avatar, Button, PressableScale, Text } from '@/ui';
import { theme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icono de cada método, para el botón y para la fila del perfil. */
export const deviceAuthIcon = (kind: DeviceAuthKind): IconName => {
  switch (kind) {
    case 'face':
      return 'scan-outline';
    case 'fingerprint':
      return 'finger-print';
    case 'iris':
      return 'eye-outline';
    case 'passcode':
      return 'keypad-outline';
  }
};

export interface QuickLoginPanelProps {
  account: RememberedAccount;
  kind: DeviceAuthKind;
  /** Autenticando con el teléfono o iniciando sesión. */
  loading: boolean;
  onUnlock: () => void;
  /** Misma cuenta, pero escribiendo la contraseña. */
  onUsePassword: () => void;
  /** Otra persona: formulario vacío. */
  onUseOtherAccount: () => void;
}

export const QuickLoginPanel = ({
  account,
  kind,
  loading,
  onUnlock,
  onUsePassword,
  onUseOtherAccount,
}: QuickLoginPanelProps) => {
  return (
    <View style={styles.container}>
      <Avatar name={account.firstName || account.identifier} size="lg" />

      <View style={styles.heading}>
        <Text variant="title2" align="center">
          {account.firstName ? `Hola de nuevo, ${account.firstName}` : 'Hola de nuevo'}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {maskIdentifier(account.identifier)}
        </Text>
      </View>

      <Button
        label={`Entrar con ${deviceAuthLabel(kind)}`}
        icon={deviceAuthIcon(kind)}
        onPress={onUnlock}
        loading={loading}
        size="lg"
        fullWidth
        style={styles.unlock}
      />

      <PressableScale
        onPress={onUsePassword}
        disabled={loading}
        haptic="select"
        accessibilityRole="button"
        style={styles.link}
      >
        <Text variant="captionStrong" color="brandStrong">
          Entrar con mi contraseña
        </Text>
      </PressableScale>

      <View style={styles.footer}>
        <Text variant="body" color="textMuted">
          {account.firstName ? `¿No eres ${account.firstName}?` : '¿Es otra cuenta?'}
        </Text>
        <PressableScale
          onPress={onUseOtherAccount}
          disabled={loading}
          haptic="tap"
          accessibilityRole="button"
          style={styles.footerAction}
        >
          <Text variant="bodyStrong" color="brandStrong">
            Usar otra cuenta
          </Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  heading: {
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.md,
  },
  unlock: {
    marginTop: theme.spacing.xl,
  },
  link: {
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  footerAction: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
});
