/**
 * Modo cliente sin ninguna tienda vinculada.
 *
 * Es el estado vacío más importante del modo: quien cambia a cliente por
 * curiosidad cae aquí, y si solo viera "no hay nada" se iría pensando que la
 * función no sirve. Así que esta pantalla explica **por qué** está vacía y
 * da las dos salidas reales, que son las dos únicas formas en que el backend
 * crea el vínculo (`Debtor.userId`):
 *
 *  1. que la tienda lo registre con el mismo documento o celular de su
 *     cuenta — el backend los cruza solo al registrarse;
 *  2. que la tienda le comparta un código de invitación.
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

/** Las dos vías de vinculación, en el orden en que suelen ocurrir. */
const STEPS = [
  {
    icon: 'card-outline',
    title: 'Dale tus datos a la tienda',
    description:
      'Pide que te registren con tu cédula o tu celular. Si coinciden con los de tu cuenta, el vínculo se crea solo.',
  },
  {
    icon: 'ticket-outline',
    title: 'O pide un código',
    description:
      'La tienda puede generarte un código de invitación. Escríbelo aquí y quedas vinculado al instante.',
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
        aquí, la tienda tiene que vincularte a tu cuenta.
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
        onPress={() => router.push(routes.invitation.accept)}
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
