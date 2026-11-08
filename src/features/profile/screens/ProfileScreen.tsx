/**
 * Perfil y ajustes.
 *
 * El menú del v1 tenía dos opciones que no llevaban a ninguna parte
 * (Notificaciones y Ayuda, con el handler vacío). Un botón muerto es peor que
 * no ponerlo: aquí lo pendiente se marca como "Pronto" y avisa al tocarlo, así
 * el usuario sabe que la función existe y que todavía no está lista.
 *
 * El cierre de sesión pide confirmación, porque volver a entrar cuesta.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { env } from '@/core/config/env';
import { toAppError } from '@/core/errors/AppError';
import { routes } from '@/core/navigation/routes';
import { formatPhone, pluralize } from '@/core/utils/format';
import { displayName } from '@/domain/models';
import { useSession } from '@/features/auth/session/SessionProvider';
import { RoleBadge } from '@/features/businesses/components/RoleBadge';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { ModeSwitcher } from '@/features/client/components/ModeSwitcher';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import {
  Avatar,
  Badge,
  Card,
  Dialog,
  Divider,
  IconBubble,
  PressableScale,
  Screen,
  Text,
  useDialog,
  useToast,
} from '@/ui';
import { theme } from '@/theme';
import { LEGAL_CONTACT } from '@/domain/legal';

// El mismo correo que publican los términos: una sola fuente para que no se desincronicen.
const SUPPORT_EMAIL = LEGAL_CONTACT.email;

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { businesses, activeBusiness, activeRole } = useBusinesses();
  const { mode, accounts, hasConfirmedNoAccounts } = useAppMode();
  const dialog = useDialog();
  const toast = useToast();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fullName = displayName(user);
  const isClientMode = mode === 'client';

  /**
   * Salir de este dispositivo o de todos.
   *
   * El backend mantiene una sesión por aparato, así que cerrar aquí ya no
   * toca las demás. "Todos los dispositivos" existe para el caso que motivó
   * el cambio: un teléfono perdido o prestado.
   */
  const handleLogout = (allDevices = false) => {
    dialog.confirm({
      tone: 'danger',
      title: allDevices ? '¿Cerrar sesión en todos?' : '¿Cerrar sesión?',
      message: allDevices
        ? 'Se cerrará aquí y en cualquier otro teléfono o tablet donde hayas entrado.'
        : 'Tendrás que ingresar tu correo y contraseña para volver a entrar.',
      confirmLabel: 'Cerrar sesión',
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await logout({ allDevices });
          router.replace(routes.auth.login);
        } catch (caught) {
          dialog.showError(toAppError(caught));
        } finally {
          setIsLoggingOut(false);
        }
      },
    });
  };

  const handleSupport = () => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ayuda con Appuntao')}`,
    ).catch(() => toast.info(`Escríbenos a ${SUPPORT_EMAIL}`));
  };

  return (
    <Screen scroll statusBar="light">
      {/* ── Héroe de identidad ──────────────────────────────────────────── */}
      <LinearGradient
        colors={theme.gradient.hero}
        style={[styles.hero, { paddingTop: insets.top + theme.spacing['2xl'] }]}
      >
        <Avatar name={fullName} size="xl" />

        <Text variant="title2" color="textInverse" align="center" numberOfLines={2}>
          {fullName}
        </Text>

        {user?.email ? (
          <Text variant="caption" color="textInverseMuted" numberOfLines={1}>
            {user.email}
          </Text>
        ) : null}

        <View style={styles.heroMeta}>
          {user?.documentNumber ? (
            <Badge
              label={`${user.documentType ?? 'CC'} ${user.documentNumber}`}
              tone="neutral"
            />
          ) : null}
          <Badge
            label={
              isClientMode
                ? pluralize(accounts.length, 'tienda')
                : pluralize(businesses.length, 'negocio')
            }
            tone="brand"
            icon={isClientMode ? 'wallet' : 'storefront'}
          />
        </View>

        {/*
          El perfil es la misma pantalla en los dos modos, así que el
          interruptor vive aquí también: es el sitio donde la gente busca los
          ajustes de su cuenta cuando no encuentra la píldora del inicio.
        */}
        <View style={styles.heroSwitcher}>
          <ModeSwitcher inverse />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* ── Datos de contacto ───────────────────────────────────────────── */}
        {user?.phone ? (
          <Card padding="md" style={styles.contactCard}>
            <View style={styles.contactRow}>
              <IconBubble icon="call-outline" tone="brand" size={38} />
              <View style={styles.contactBody}>
                <Text variant="overline" color="textSubtle">
                  Tu celular
                </Text>
                <Text variant="bodyStrong">{formatPhone(user.phone)}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* ── Cuenta ──────────────────────────────────────────────────────── */}
        <Text variant="overline" color="textSubtle" style={styles.groupLabel}>
          Cuenta
        </Text>

        <Card padding="none" style={styles.group}>
          <SettingRow
            icon="person-outline"
            label="Editar perfil"
            description="Nombre, documento y contacto"
            onPress={() => router.push(routes.settings.profile)}
          />
          <Divider inset />
          <SettingRow
            icon="lock-closed-outline"
            label="Seguridad"
            description="Cambia tu contraseña"
            onPress={() => router.push(routes.settings.security)}
          />
          <Divider inset />
          <SettingRow
            icon="notifications-outline"
            label="Notificaciones"
            description="Recordatorios de cobro"
            badge="Pronto"
            onPress={() =>
              toast.info('Los recordatorios de cobro llegarán en una próxima versión.')
            }
          />
        </Card>

        {/* ── Negocio (tendero) o tiendas (cliente) ───────────────────────── */}
        <Text variant="overline" color="textSubtle" style={styles.groupLabel}>
          {isClientMode ? 'Donde te fían' : 'Negocio'}
        </Text>

        <Card padding="none" style={styles.group}>
          {isClientMode ? (
            <SettingRow
              icon="wallet-outline"
              label="Mis tiendas"
              description={
                accounts.length > 0
                  ? pluralize(accounts.length, 'tienda')
                  : hasConfirmedNoAccounts
                    ? 'Todavía nadie te ha vinculado'
                    : // La consulta no respondió: no se afirma que no hay ninguna.
                      'Toca para ver tus tiendas'
              }
              onPress={() => router.push(routes.clientMode.wallet)}
            />
          ) : (
            <>
              <SettingRow
                icon="storefront-outline"
                label="Mis negocios"
                description={
                  activeBusiness
                    ? `${activeBusiness.name} · ${pluralize(businesses.length, 'negocio', 'negocios')}`
                    : pluralize(businesses.length, 'negocio', 'negocios')
                }
                // Muestra el rol en el negocio activo (Dueño / Cajero…). Solo aparece
                // cuando el backend ya trajo la membresía; si no, se omite.
                trailing={activeRole ? <RoleBadge role={activeRole} /> : undefined}
                onPress={() => router.push(routes.tabs.businesses)}
              />
              {activeBusiness ? (
                <>
                  <Divider inset />
                  <SettingRow
                    icon="people-outline"
                    label="Equipo"
                    description="Quién tiene acceso a tu negocio"
                    onPress={() => router.push(routes.team.list)}
                  />
                </>
              ) : null}
            </>
          )}
          <Divider inset />
          <SettingRow
            icon="ticket-outline"
            label="Tengo un código"
            // Un mismo código sirve para las dos cosas: el backend distingue
            // entre invitación al equipo y vínculo como cliente por su `type`.
            description="Únete a un negocio o vincúlate a una tienda"
            onPress={() => router.push(routes.invitation.accept)}
          />
        </Card>

        {/* ── Soporte ─────────────────────────────────────────────────────── */}
        <Text variant="overline" color="textSubtle" style={styles.groupLabel}>
          Ayuda
        </Text>

        <Card padding="none" style={styles.group}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Contactar soporte"
            description={SUPPORT_EMAIL}
            onPress={handleSupport}
          />
          <Divider inset />
          {/* Una sola fila: la lista la decide el catálogo del backend. */}
          <SettingRow
            icon="document-text-outline"
            label="Documentos legales"
            description="Términos, tratamiento de datos y más"
            onPress={() => router.push(routes.legal.index)}
          />
        </Card>

        {/* ── Cerrar sesión ───────────────────────────────────────────────── */}
        <Card padding="none" style={styles.group}>
          <SettingRow
            icon="log-out-outline"
            label={isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            destructive
            onPress={() => handleLogout()}
          />
          <Divider inset />
          <SettingRow
            icon="phone-portrait-outline"
            label="Cerrar sesión en todos los dispositivos"
            description="Útil si perdiste un celular o entraste en uno prestado"
            destructive
            onPress={() => handleLogout(true)}
          />
        </Card>

        <Text variant="caption" color="textSubtle" align="center" style={styles.version}>
          Appuntao v2.0.0
          {env.environment === 'prd' ? '' : ` · ${env.environment}`}
        </Text>
      </View>

      <Dialog {...dialog.props} loading={isLoggingOut} />
    </Screen>
  );
};

/* ── Fila de ajuste ───────────────────────────────────────────────────────── */

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  badge?: string;
  /** Contenido a la derecha (un badge propio) que reemplaza a `badge`. */
  trailing?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

const SettingRow = ({
  icon,
  label,
  description,
  badge,
  trailing,
  destructive = false,
  onPress,
}: SettingRowProps) => (
  <PressableScale
    onPress={onPress}
    haptic="tap"
    activeScale={0.99}
    accessibilityRole="button"
    accessibilityLabel={description ? `${label}. ${description}` : label}
    style={styles.settingRow}
  >
    <IconBubble icon={icon} tone={destructive ? 'danger' : 'neutral'} size={38} />

    <View style={styles.settingBody}>
      <Text variant="bodyStrong" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
        {label}
      </Text>
      {description ? (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {description}
        </Text>
      ) : null}
    </View>

    {trailing ?? (badge ? <Badge label={badge} tone="info" /> : null)}

    {!destructive ? (
      <Ionicons name="chevron-forward" size={18} color={theme.color.textSubtle} />
    ) : null}
  </PressableScale>
);

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing['2xl'],
    borderBottomLeftRadius: theme.radius['3xl'],
    borderBottomRightRadius: theme.radius['3xl'],
  },
  heroSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  body: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.xl,
  },
  contactCard: {
    marginBottom: theme.spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  contactBody: {
    flex: 1,
    gap: 1,
  },
  groupLabel: {
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  group: {
    marginBottom: theme.spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  settingBody: {
    flex: 1,
    gap: 1,
  },
  version: {
    marginTop: theme.spacing.sm,
  },
});
