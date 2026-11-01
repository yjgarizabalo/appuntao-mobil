/**
 * Interruptor de modo: pasar de tendero a cliente y volver.
 *
 * Es el mismo gesto de inDriver o Rappi cuando se cambia de conductor a
 * pasajero: una píldora siempre visible en el encabezado que dice en qué modo
 * estás, y una hoja que explica los dos antes de cambiar. Se eligió la hoja y
 * no un conmutador seco porque el cambio reemplaza la barra de pestañas
 * entera; hacerlo sin avisar desorienta.
 *
 * La píldora vive sobre los héroes oscuros de los dos inicios, de ahí `inverse`.
 *
 * Al cambiar se usa `router.replace` y no `push`: los dos modos son raíces
 * distintas de la app, no una encima de otra. Con `push` el botón de atrás
 * del teléfono devolvería al modo anterior, que es justo lo que no se quiere.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { haptics } from '@/core/haptics';
import { routes } from '@/core/navigation/routes';
import {
  APP_MODE_DESCRIPTION,
  APP_MODE_LABEL,
  type AppMode,
  useAppMode,
} from '@/features/client/state/AppModeProvider';
import { IconBubble, PressableScale, Sheet, Text } from '@/ui';
import { theme } from '@/theme';

/**
 * Iconos de los **modos**, para distinguirlos dentro de la hoja.
 *
 * No se usan en la píldora a propósito: ahí `storefront` chocaba con la
 * pestaña "Negocios" y `wallet` con la de "Mi cuenta" —el mismo glifo
 * significando dos cosas en la misma pantalla—. La píldora lleva el icono de
 * la *acción* (cambiar), y quién es cada modo lo dice el texto.
 */
const MODE_ICON: Record<AppMode, keyof typeof Ionicons.glyphMap> = {
  merchant: 'storefront-outline',
  client: 'wallet-outline',
};

export interface ModeSwitcherProps {
  /** Sobre un héroe oscuro. */
  inverse?: boolean;
}

export const ModeSwitcher = ({ inverse = false }: ModeSwitcherProps) => {
  const { mode, setMode, isLinked, isLoadingAccounts, hasConfirmedNoAccounts } =
    useAppMode();
  const [isOpen, setIsOpen] = useState(false);

  const choose = (next: AppMode) => {
    setIsOpen(false);
    if (next === mode) return;

    haptics.success();
    setMode(next);
    router.replace(next === 'client' ? routes.clientMode.wallet : routes.tabs.home);
  };

  return (
    <>
      <PressableScale
        onPress={() => setIsOpen(true)}
        haptic="tap"
        activeScale={0.96}
        accessibilityRole="button"
        accessibilityLabel={`Modo ${APP_MODE_LABEL[mode].toLowerCase()}. Tocar para cambiar de modo`}
        style={[styles.pill, inverse ? styles.pillInverse : styles.pillPlain]}
      >
        <Ionicons
          name="swap-horizontal"
          size={14}
          color={inverse ? theme.color.textInverse : theme.color.brandStrong}
        />
        <Text variant="captionStrong" color={inverse ? 'textInverse' : 'brandStrong'}>
          Modo {APP_MODE_LABEL[mode].toLowerCase()}
        </Text>
      </PressableScale>

      <Sheet
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title="¿Cómo quieres usar Fiao?"
        subtitle="Una sola cuenta, los dos lados del mostrador."
      >
        <View style={styles.options}>
          <ModeOption
            mode="merchant"
            active={mode === 'merchant'}
            onPress={() => choose('merchant')}
          />
          <ModeOption
            mode="client"
            active={mode === 'client'}
            /*
              Solo se afirma "ninguna tienda te ha vinculado" cuando el
              servidor lo confirmó. Si la consulta falló —el backend gratuito
              responde 5xx mientras despierta— no se dice nada: el modo entra
              igual y allí sí se explica qué pasó.
            */
            note={
              isLoadingAccounts
                ? 'Buscando tus tiendas…'
                : isLinked
                  ? undefined
                  : hasConfirmedNoAccounts
                    ? 'Todavía ninguna tienda te ha vinculado'
                    : undefined
            }
            onPress={() => choose('client')}
          />
        </View>
      </Sheet>
    </>
  );
};

/* ── Opción de la hoja ────────────────────────────────────────────────────── */

interface ModeOptionProps {
  mode: AppMode;
  active: boolean;
  note?: string;
  onPress: () => void;
}

const ModeOption = ({ mode, active, note, onPress }: ModeOptionProps) => (
  <PressableScale
    onPress={onPress}
    haptic="select"
    activeScale={0.985}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`${APP_MODE_LABEL[mode]}. ${APP_MODE_DESCRIPTION[mode]}`}
    style={[styles.option, active ? styles.optionActive : null]}
  >
    <IconBubble icon={MODE_ICON[mode]} tone={active ? 'brand' : 'neutral'} size={44} />

    <View style={styles.optionBody}>
      <Text variant="bodyStrong">{APP_MODE_LABEL[mode]}</Text>
      <Text variant="caption" color="textMuted">
        {APP_MODE_DESCRIPTION[mode]}
      </Text>
      {note ? (
        <Text variant="caption" color="textSubtle">
          {note}
        </Text>
      ) : null}
    </View>

    {active ? (
      <Ionicons name="checkmark-circle" size={22} color={theme.color.brandStrong} />
    ) : (
      <Ionicons name="chevron-forward" size={18} color={theme.color.textSubtle} />
    )}
  </PressableScale>
);

const styles = StyleSheet.create({
  /**
   * Sin `alignSelf`: la alineación la decide quien la coloca. Cuando la
   * píldora forzaba `flex-start` se desalineaba dentro de las filas del héroe,
   * porque en un contenedor en fila ese `alignSelf` actúa sobre el eje
   * vertical y anulaba el centrado del padre.
   */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  pillInverse: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pillPlain: {
    backgroundColor: theme.color.brandSoft,
  },
  options: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  optionActive: {
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandSoft,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
});
