/**
 * Modo cliente sin ninguna tienda vinculada.
 *
 * Es el estado vacío más importante del modo: quien cambia a cliente por
 * curiosidad cae aquí, y si solo viera "no hay nada" se iría pensando que la
 * función no sirve. Así que esta pantalla explica **por qué** está vacía y
 * cómo se llena.
 *
 * El vínculo (`Debtor.userId`) solo se crea aceptando una invitación de la
 * tienda: el backend dejó de vincular solo por documento o celular, porque
 * eso dejaba que cualquier negocio "reclamara" a una persona. La invitación
 * va al celular o correo de la cuenta y aparece arriba de esta pantalla
 * (`IncomingInvitationsCard`); el código es el respaldo.
 *
 * Y siempre deja volver al modo tendero: nadie debe quedar encerrado en un
 * modo que todavía no puede usar.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { routes } from '@/core/navigation/routes';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import { Button, Card, IconBubble, Text } from '@/ui';
import { theme } from '@/theme';

/** Cómo se vincula, en el orden en que ocurre. */
const STEPS = [
  {
    icon: 'logo-whatsapp',
    title: 'Pide que la tienda te invite',
    description:
      'Desde tu ficha de cliente, la tienda te envía una invitación al celular o al correo de tu cuenta.',
  },
  {
    icon: 'notifications-outline',
    title: 'Acéptala aquí',
    description:
      'Te aparece al abrir la app. Si te pasaron un código, también puedes escribirlo.',
  },
] as const;

export const ClientNotLinked = () => {
  const { setMode } = useAppMode();

  const backToMerchant = () => {
    setMode('merchant');
    router.replace(routes.tabs.home);
  };

  return (
    <View style={styles.container}>
      <IconBubble icon="wallet-outline" tone="brand" size={64} />

      <Text variant="title2" align="center" style={styles.title}>
        Todavía nadie te ha vinculado
      </Text>
      <Text variant="body" color="textMuted" align="center" style={styles.message}>
        En modo cliente ves lo que debes en las tiendas donde te fían. Para que aparezcan
        aquí, la tienda tiene que invitarte y tú aceptar.
      </Text>

      <Card padding="lg" style={styles.steps}>
        {STEPS.map((step, index) => (
          <View
            key={step.title}
            style={[styles.step, index > 0 ? styles.stepSpaced : null]}
          >
            <IconBubble icon={step.icon} tone="neutral" size={40} />
            <View style={styles.stepBody}>
              <Text variant="bodyStrong">{step.title}</Text>
              <Text variant="caption" color="textMuted">
                {step.description}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Button
        label="Tengo un código"
        icon="ticket-outline"
        onPress={() => router.push(routes.invitation.accept())}
        size="lg"
        fullWidth
      />

      <Button
        label="Volver al modo tendero"
        variant="ghost"
        icon="storefront-outline"
        onPress={backToMerchant}
        fullWidth
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: theme.spacing['3xl'],
    gap: theme.spacing.sm,
  },
  title: {
    marginTop: theme.spacing.lg,
  },
  message: {
    maxWidth: 320,
  },
  steps: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  stepSpaced: {
    marginTop: theme.spacing.lg,
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
});
