import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Grouped list section: small caps title, rounded card, hairline separators. */
export function SettingsSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? (
              <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>{footer}</ThemedText>
      ) : null}
    </View>
  );
}

/** Rounded colored square holding a row's icon. */
function SettingsIcon({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={[styles.icon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={16} color="#ffffff" />
    </View>
  );
}

/** One row: icon, label (and optional detail), then a value, a control or a chevron. */
export function SettingsRow({
  icon,
  iconColor,
  label,
  detail,
  value,
  right,
  onPress,
  chevron = !!onPress,
  destructive = false,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  detail?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <>
      {icon ? <SettingsIcon icon={icon} color={iconColor ?? theme.tint} /> : null}
      <View style={styles.labels}>
        <ThemedText style={[styles.label, destructive && { color: theme.danger }]}>{label}</ThemedText>
        {detail ? (
          <ThemedText style={[styles.detail, { color: theme.textSecondary }]}>{detail}</ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      {content}
    </Pressable>
  );
}

/** Compact minus / value / plus control for numeric settings. */
export function Stepper({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  canDecrement = true,
  canIncrement = true,
}: {
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
}) {
  const theme = useTheme();
  const button = (icon: IconName, label: string, enabled: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: theme.background, opacity: enabled ? (pressed ? 0.6 : 1) : 0.35 },
      ]}>
      <Ionicons name={icon} size={16} color={theme.tint} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button('remove', decrementLabel, canDecrement, onDecrement)}
      <ThemedText style={styles.stepValue}>{value}</ThemedText>
      {button('add', incrementLabel, canIncrement, onIncrement)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 1,
    paddingHorizontal: Spacing.three,
  },
  card: { borderRadius: 20, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  footer: { fontSize: 12.5, lineHeight: 17, paddingHorizontal: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 54,
    paddingVertical: 10,
  },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  labels: { flex: 1, gap: 1 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: 500 },
  detail: { fontSize: 12.5, lineHeight: 16 },
  value: { fontSize: 15, lineHeight: 20, maxWidth: '45%' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 52, textAlign: 'center', fontSize: 15, lineHeight: 20, fontWeight: 700 },
});
