/**
 * Piezas pequeñas de composición: separadores, encabezados de sección, filas,
 * pies de lista y una tarjeta de estadística.
 *
 * Están juntas a propósito: cada una son diez líneas y siempre se usan en el
 * mismo contexto (armar una lista o una pantalla de detalle).
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { theme } from '@/theme';
import type { SpacingToken } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

/* ── Espaciador y separador ───────────────────────────────────────────────── */

export const Spacer = ({ size = 'lg' }: { size?: SpacingToken }) => (
  <View style={{ height: theme.spacing[size] }} />
);

export const Divider = ({
  inset = false,
  inverse = false,
}: {
  inset?: boolean;
  inverse?: boolean;
}) => (
  <View
    style={[
      styles.divider,
      {
        backgroundColor: inverse ? theme.color.borderInverse : theme.color.border,
        marginLeft: inset ? theme.spacing['4xl'] : 0,
      },
    ]}
  />
);

/* ── Encabezado de sección ────────────────────────────────────────────────── */

export interface SectionHeaderProps {
  title: string;
  /** Texto secundario a la derecha (contador, total). */
  meta?: string;
  /** Acción de texto a la derecha ("Ver todos"). */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const SectionHeader = ({
  title,
  meta,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) => (
  <View style={[styles.sectionHeader, style]}>
    <View style={styles.sectionTitleGroup}>
      <Text variant="title3">{title}</Text>
      {meta ? (
        <Text variant="caption" color="textSubtle">
          {meta}
        </Text>
      ) : null}
    </View>

    {actionLabel && onAction ? (
      <PressableScale onPress={onAction} haptic="select" style={styles.sectionAction}>
        <Text variant="captionStrong" color="brandStrong">
          {actionLabel}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.color.brandStrong} />
      </PressableScale>
    ) : null}
  </View>
);

/* ── Fila de lista ────────────────────────────────────────────────────────── */

export interface ListRowProps {
  /** Contenido a la izquierda: avatar, icono en círculo… */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Contenido a la derecha: importe, badge… */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Muestra la flecha de "entrar". */
  chevron?: boolean;
  /** `card` = tarjeta independiente. `plain` = fila dentro de una tarjeta. */
  appearance?: 'card' | 'plain';
  destructive?: boolean;
  style?: ViewStyle;
}

export const ListRow = ({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron = false,
  appearance = 'card',
  destructive = false,
  style,
}: ListRowProps) => {
  const content = (
    <>
      {leading}

      <View style={styles.rowBody}>
        <Text
          variant="bodyStrong"
          color={destructive ? 'danger' : 'text'}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}

      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={theme.color.textSubtle} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    appearance === 'card' ? styles.rowCard : styles.rowPlain,
    style ?? {},
  ];

  if (!onPress) return <View style={rowStyle}>{content}</View>;

  return (
    <PressableScale
      onPress={onPress}
      style={rowStyle}
      activeScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      {content}
    </PressableScale>
  );
};

/* ── Icono en círculo ─────────────────────────────────────────────────────── */

export interface IconBubbleProps {
  icon: IconName;
  tone?: 'neutral' | 'brand' | 'danger' | 'warning' | 'info';
  size?: number;
}

const BUBBLE_TONES = {
  neutral: { background: theme.color.surfaceSunken, foreground: theme.color.textMuted },
  brand: { background: theme.color.brandSoft, foreground: theme.color.brandStrong },
  danger: { background: theme.color.dangerSoft, foreground: theme.color.dangerStrong },
  warning: { background: theme.color.warningSoft, foreground: theme.color.warningStrong },
  info: { background: theme.color.infoSoft, foreground: theme.color.infoStrong },
} as const;

export const IconBubble = ({ icon, tone = 'neutral', size = 44 }: IconBubbleProps) => {
  const palette = BUBBLE_TONES[tone];
  return (
    <View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 3.2,
          backgroundColor: palette.background,
        },
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={palette.foreground} />
    </View>
  );
};

/* ── Pie de lista mientras pagina ─────────────────────────────────────────── */

export const ListFooterLoader = ({ visible }: { visible: boolean }) =>
  visible ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={theme.color.textSubtle} />
      <Text variant="caption" color="textSubtle">
        Cargando más…
      </Text>
    </View>
  ) : null;

/* ── Tarjeta de estadística ───────────────────────────────────────────────── */

export interface StatTileProps {
  label: string;
  value: string;
  icon?: IconName;
  tone?: 'neutral' | 'brand' | 'danger' | 'warning';
  /** Sobre fondo oscuro. */
  inverse?: boolean;
  style?: ViewStyle;
}

export const StatTile = ({
  label,
  value,
  icon,
  tone = 'neutral',
  inverse = false,
  style,
}: StatTileProps) => {
  const valueColor = inverse
    ? theme.color.textInverse
    : tone === 'danger'
      ? theme.color.dangerStrong
      : tone === 'brand'
        ? theme.color.brandStrong
        : tone === 'warning'
          ? theme.color.warningStrong
          : theme.color.text;

  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: inverse ? theme.color.fillInverseSubtle : theme.color.surface,
          borderColor: inverse ? theme.color.borderInverse : theme.color.border,
        },
        style,
      ]}
    >
      <View style={styles.statLabelRow}>
        {icon ? (
          <Ionicons
            name={icon}
            size={13}
            color={inverse ? theme.color.textInverseMuted : theme.color.textSubtle}
          />
        ) : null}
        <Text
          variant="overline"
          color={inverse ? 'textInverseMuted' : 'textSubtle'}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text variant="money" color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 2,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowPlain: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  statTile: {
    flex: 1,
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
});
