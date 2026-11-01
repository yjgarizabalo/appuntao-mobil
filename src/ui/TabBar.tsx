/**
 * Barra de pestañas propia.
 *
 * La barra por defecto de React Navigation funciona, pero se ve genérica.
 * Esta:
 *  - marca la pestaña activa con una píldora de color que se anima;
 *  - responde al tacto con vibración y un pequeño rebote del icono;
 *  - respeta el inset inferior real (barra de gestos del iPhone y de Android);
 *  - flota sobre el contenido con una sombra, que es el patrón que usan las
 *    apps de delivery.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/core/haptics';
import { Text } from './Text';
import { theme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Iconos por nombre de ruta: relleno cuando está activa, contorno cuando no. */
const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  /* Modo tendero */
  home: { active: 'home', inactive: 'home-outline' },
  businesses: { active: 'storefront', inactive: 'storefront-outline' },
  clients: { active: 'people', inactive: 'people-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
  /* Modo cliente */
  wallet: { active: 'wallet', inactive: 'wallet-outline' },
  movements: { active: 'swap-vertical', inactive: 'swap-vertical-outline' },
  me: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
      ]}
    >
      {state.routes.map((route, index) => {
        // `noUncheckedIndexedAccess` obliga a tratar el descriptor como
        // opcional: la ruta podría no tener uno si se desmonta a mitad.
        const descriptor = descriptors[route.key];
        const isFocused = state.index === index;
        const icons = ICONS[route.name] ?? {
          active: 'ellipse',
          inactive: 'ellipse-outline',
        };
        const title = descriptor?.options.title;
        const label = typeof title === 'string' ? title : route.name;

        const handlePress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (isFocused || event.defaultPrevented) return;
          haptics.select();
          navigation.navigate(route.name, route.params);
        };

        return (
          <TabItem
            key={route.key}
            label={label}
            icon={isFocused ? icons.active : icons.inactive}
            focused={isFocused}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
};

interface TabItemProps {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
}

const TabItem = ({ label, icon, focused, onPress }: TabItemProps) => {
  const progress = useDerivedValue(
    () => withSpring(focused ? 1 : 0, theme.spring.snappy),
    [focused],
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.value * 2 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <View style={styles.iconArea}>
        <Animated.View style={[styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons
            name={icon}
            size={23}
            color={focused ? theme.color.brandStrong : theme.color.textSubtle}
          />
        </Animated.View>
      </View>

      <Text
        variant="overline"
        color={focused ? 'brandStrong' : 'textSubtle'}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.sm,
    ...theme.shadow.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: theme.spacing.xxs,
  },
  iconArea: {
    width: 52,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.brandSoft,
  },
});
