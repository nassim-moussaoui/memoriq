import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Large pill button with a springy press. `soft` is the tinted secondary look. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon = 'arrow-forward',
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName | null;
  variant?: 'solid' | 'soft';
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.96]) }],
  }));
  const solid = variant === 'solid';
  const fg = solid ? '#ffffff' : theme.tint;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: 90 }));
      }}
      onPressOut={() => {
        pressed.set(withSpring(0, { damping: 12, stiffness: 260 }));
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.button,
        { backgroundColor: solid ? theme.tint : theme.tintSoft, opacity: disabled ? 0.4 : 1 },
        animatedStyle,
      ]}>
      <ThemedText style={[styles.label, { color: fg }]}>{label}</ThemedText>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingVertical: Spacing.three + 2,
    paddingHorizontal: Spacing.four,
  },
  label: { fontSize: 17, lineHeight: 22, fontWeight: 700 },
});
