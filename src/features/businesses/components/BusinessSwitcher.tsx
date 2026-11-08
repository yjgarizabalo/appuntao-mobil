/**
 * Selector de negocio activo.
 *
 * En el v1 el negocio se resolvía implícitamente con `businesses[0]?.id`, así
 * que un tendero con dos tiendas nunca sabía a cuál le estaba fiando. Aquí el
 * negocio activo está siempre visible y se cambia en dos toques.
 *
 * Si el usuario solo tiene un negocio, se muestra como texto sin gesto de
 * cambio: no tiene sentido ofrecer una elección de una sola opción.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { haptics } from '@/core/haptics';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { Divider, IconBubble, PressableScale, Sheet, Text } from '@/ui';
import { theme } from '@/theme';

export interface BusinessSwitcherProps {
  /** `inverse` para usarlo sobre el héroe oscuro. */
  inverse?: boolean;
  style?: ViewStyle;
}

export const BusinessSwitcher = ({ inverse = false, style }: BusinessSwitcherProps) => {
  const { businesses, activeBusiness, selectBusiness } = useBusinesses();
  const [isOpen, setIsOpen] = useState(false);

  if (!activeBusiness) return null;

  const isSwitchable = businesses.length > 1;
  const foreground = inverse ? theme.color.textInverse : theme.color.text;
  const mutedForeground = inverse ? theme.color.textInverseMuted : theme.color.textMuted;

  const handleSelect = (businessId: string) => {
    haptics.select();
    selectBusiness(businessId);
    setIsOpen(false);
  };

  return (
    <>
      <PressableScale
        onPress={isSwitchable ? () => setIsOpen(true) : undefined}
        disabled={!isSwitchable}
        haptic="tap"
        activeScale={0.98}
        accessibilityRole={isSwitchable ? 'button' : 'text'}
        accessibilityLabel={
          isSwitchable
            ? `Negocio activo: ${activeBusiness.name}. Toca para cambiar`
            : `Negocio: ${activeBusiness.name}`
        }
        style={[
          styles.trigger,
          {
            backgroundColor: inverse ? theme.color.fillInverse : theme.color.surface,
            borderColor: inverse ? theme.color.borderInverse : theme.color.border,
          },
          style,
        ]}
      >
        <Ionicons name="storefront" size={15} color={mutedForeground} />
        <Text variant="captionStrong" color={foreground} numberOfLines={1} style={styles.triggerLabel}>
          {activeBusiness.name}
        </Text>
        {isSwitchable ? (
          <Ionicons name="chevron-down" size={14} color={mutedForeground} />
        ) : null}
      </PressableScale>

      <Sheet
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title="Cambiar de negocio"
        subtitle="Los clientes y las deudas se muestran por negocio"
      >
        <View>
          {businesses.map((business, index) => {
            const isActive = business.id === activeBusiness.id;
            return (
              <View key={business.id}>
                {index > 0 ? <Divider /> : null}
                <PressableScale
                  onPress={() => handleSelect(business.id)}
                  haptic={false}
                  activeScale={0.99}
                  style={styles.option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                >
                  <IconBubble icon="storefront-outline" tone={isActive ? 'brand' : 'neutral'} />
                  <View style={styles.optionText}>
                    <Text variant="bodyStrong" color={isActive ? 'brandStrong' : 'text'}>
                      {business.name}
                    </Text>
                    {business.address ? (
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {business.address}
                      </Text>
                    ) : null}
                  </View>
                  {isActive ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.color.brand} />
                  ) : null}
                </PressableScale>
              </View>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    maxWidth: 240,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
  },
  triggerLabel: {
    flexShrink: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
});
