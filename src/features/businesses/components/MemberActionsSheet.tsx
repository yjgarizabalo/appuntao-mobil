/**
 * Hoja para gestionar a un miembro del equipo: cambiar su rol o quitarlo.
 *
 * Las opciones de rol se pintan en línea (no con un `OptionPicker`, que abriría
 * una segunda hoja encima de esta y en Android el gesto se pierde). El dueño no
 * se puede tocar, así que el padre solo abre esta hoja para miembros
 * gestionables; aquí se muestran únicamente las acciones que el rol propio
 * permite (`canManageRole`, `canRemove`) y solo los roles que puede asignar
 * (`roleOptions`: el administrador no ve "Administrador").
 *
 * "Quitar del negocio" no confirma aquí: el padre cierra la hoja y abre la
 * confirmación en `onClosed`, para que el diálogo no quede detrás de la hoja.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import {
  ASSIGNABLE_BUSINESS_ROLE_OPTIONS,
  type AssignableBusinessRole,
  type BusinessRole,
} from '@/domain/constants';
import type { Member } from '@/domain/models';
import { Button, Divider, PressableScale, Sheet, Text } from '@/ui';
import { theme } from '@/theme';

export interface MemberActionsSheetProps {
  member: Member | null;
  visible: boolean;
  onClose: () => void;
  /** La hoja terminó de cerrarse. Ver `SheetProps.onClosed`. */
  onClosed?: () => void;
  canManageRole: boolean;
  /** Los roles que quien gestiona puede asignar. */
  roleOptions: readonly AssignableBusinessRole[];
  canRemove: boolean;
  onChangeRole: (role: BusinessRole) => void;
  onRemove: () => void;
  /** Bloquea la hoja mientras corre una operación. */
  isBusy: boolean;
}

export const MemberActionsSheet = ({
  member,
  visible,
  onClose,
  onClosed,
  canManageRole,
  roleOptions,
  canRemove,
  onChangeRole,
  onRemove,
  isBusy,
}: MemberActionsSheetProps) => (
  <Sheet
    visible={visible}
    onClose={onClose}
    onClosed={onClosed}
    dismissible={!isBusy}
    title={member ? `Gestionar a ${member.name}` : 'Gestionar'}
    subtitle={member?.email ?? member?.phone ?? undefined}
  >
    {canManageRole ? (
      <View style={styles.section}>
        <Text variant="captionStrong" color="textMuted" style={styles.sectionLabel}>
          Rol en el negocio
        </Text>

        {ASSIGNABLE_BUSINESS_ROLE_OPTIONS.filter((option) =>
          roleOptions.includes(option.value),
        ).map((option, index) => {
          const isSelected = member?.role === option.value;
          return (
            <View key={option.value}>
              {index > 0 ? <Divider /> : null}
              <PressableScale
                onPress={() => onChangeRole(option.value)}
                disabled={isBusy || isSelected}
                haptic={false}
                activeScale={0.99}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled: isBusy }}
                style={styles.option}
              >
                <View style={styles.optionText}>
                  <Text variant="bodyStrong" color={isSelected ? 'brandStrong' : 'text'}>
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text variant="caption" color="textMuted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>

                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={22} color={theme.color.brand} />
                ) : (
                  <View style={styles.emptyMark} />
                )}
              </PressableScale>
            </View>
          );
        })}
      </View>
    ) : null}

    {canRemove ? (
      <Button
        label="Quitar del negocio"
        variant="danger"
        icon="person-remove-outline"
        onPress={onRemove}
        disabled={isBusy}
        fullWidth
        style={styles.removeButton}
      />
    ) : null}
  </Sheet>
);

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.xs,
  },
  sectionLabel: {
    marginBottom: theme.spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  emptyMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.color.borderStrong,
  },
  removeButton: {
    marginTop: theme.spacing.md,
  },
});
