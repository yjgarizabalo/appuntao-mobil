/**
 * Punto de entrada del design system.
 *
 * Las pantallas importan siempre desde `@/ui`, nunca desde el archivo
 * concreto: así se puede reorganizar el interior del kit sin tocar features.
 */
export { AnimatedMoney } from './AnimatedMoney';
export { AppBar } from './AppBar';
export { Avatar } from './Avatar';
export { Badge } from './Badge';
export { Button } from './Button';
export { Card } from './Card';
export { Checkbox, CheckboxField } from './Checkbox';
export { Dialog, useDialog } from './Dialog';
export { Fab } from './Fab';
export { IconButton } from './IconButton';
export {
  Divider,
  IconBubble,
  ListFooterLoader,
  ListRow,
  SectionHeader,
  Spacer,
  StatTile,
} from './Layout';
export { MoneyField } from './MoneyField';
export { OFFLINE_BANNER_HEIGHT, OfflineBanner } from './OfflineBanner';
export { OptionPicker } from './OptionPicker';
export { PressableScale } from './PressableScale';
export { Screen } from './Screen';
export { SearchBar } from './SearchBar';
export { SegmentedControl } from './SegmentedControl';
export { Sheet } from './Sheet';
export { CardSkeleton, ListSkeleton, RowSkeleton, Skeleton } from './Skeleton';
export { StaleNotice } from './StaleNotice';
export { EmptyState, ErrorState, OfflineState } from './StateViews';
export { TabBar } from './TabBar';
export { Text } from './Text';
export { TextField } from './TextField';
export { ToastProvider, useToast } from './Toast';

export type { AvatarSize } from './Avatar';
export type { BadgeTone } from './Badge';
export type { ButtonSize, ButtonVariant } from './Button';
export type { CheckboxFieldProps, CheckboxProps } from './Checkbox';
export type { DialogTone } from './Dialog';
export type { PickerOption } from './OptionPicker';
export type { SegmentOption } from './SegmentedControl';
export type { TextProps } from './Text';
export type { TextFieldHandle, TextFieldProps } from './TextField';
export type { ToastTone } from './Toast';
