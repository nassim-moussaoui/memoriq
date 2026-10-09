import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Staggered entrance used by every block of a step (index = order on screen). */
export function enterUp(index: number, base = 80) {
  return FadeInDown.delay(base + index * 90)
    .springify()
    .damping(20)
    .stiffness(160);
}

/** Eyebrow + title + optional body, each sliding in one after the other. */
export function StepHeader({
  eyebrow,
  title,
  body,
  align = 'center',
  startIndex = 0,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: 'center' | 'left';
  startIndex?: number;
}) {
  const theme = useTheme();
  const textAlign = align === 'center' ? 'center' : 'left';
  return (
    <View style={[styles.header, align === 'center' && styles.headerCenter]}>
      {eyebrow ? (
        <Animated.View entering={enterUp(startIndex)}>
          <ThemedText style={[styles.eyebrow, { color: theme.tint, textAlign }]}>
            {eyebrow.toUpperCase()}
          </ThemedText>
        </Animated.View>
      ) : null}
      <Animated.View entering={enterUp(startIndex + 1)}>
        <ThemedText style={[styles.title, { textAlign }]}>{title}</ThemedText>
      </Animated.View>
      {body ? (
        <Animated.View entering={enterUp(startIndex + 2)}>
          <ThemedText themeColor="textSecondary" style={[styles.body, { textAlign }]}>
            {body}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A number driven by a shared value, updated on the UI thread (no React
 * re-render per frame). Rendered through a read-only TextInput, the usual
 * Reanimated technique for animated text.
 */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  style,
}: {
  value: SharedValue<number>;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const animatedProps = useAnimatedProps(() => {
    const text = `${prefix}${Math.round(value.value)}${suffix}`;
    return { text, defaultValue: text } as unknown as TextInputProps;
  });
  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      style={[styles.counter, { color: theme.text }, style]}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Selectable card for the plan questions: the tint washes in, the icon
 * bubble fills and a check pops when selected.
 */
export function OptionCard({
  selected,
  icon,
  title,
  desc,
  badge,
  onPress,
}: {
  selected: boolean;
  icon: IconName;
  title: string;
  desc?: string;
  badge?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const on = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 220 });
  }, [on, selected]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [theme.backgroundElement, theme.tintSoft]),
    borderColor: interpolateColor(on.value, [0, 1], [theme.backgroundElement, theme.tint]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [theme.background, theme.tint]),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: 90 }));
      }}
      onPressOut={() => {
        pressed.set(withSpring(0, { damping: 12, stiffness: 260 }));
      }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.option, cardStyle]}>
      <Animated.View style={[styles.bubble, bubbleStyle]}>
        <Ionicons name={icon} size={20} color={selected ? '#ffffff' : theme.tint} />
      </Animated.View>
      <View style={styles.optionText}>
        <View style={styles.optionTitleRow}>
          <ThemedText style={styles.optionTitle}>{title}</ThemedText>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.badgeText}>{badge}</ThemedText>
            </View>
          ) : null}
        </View>
        {desc ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.optionDesc}>
            {desc}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.checkSlot}>
        {selected ? (
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <Ionicons name="checkmark-circle" size={24} color={theme.tint} />
          </Animated.View>
        ) : (
          <View style={[styles.emptyCheck, { borderColor: theme.backgroundSelected }]} />
        )}
      </View>
    </AnimatedPressable>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anchor of each glow (fractions of the screen), one per step of the flow. */
const BLOBS = [
  { color: 'tint', r: 0.75, xs: [0.1, 0.9, 0.85, 0.15, 0.2, 0.9, 0.1, 0.8, 0.5], ys: [0.12, 0.08, 0.3, 0.2, 0.05, 0.15, 0.25, 0.1, 0.1] },
  { color: 'info', r: 0.6, xs: [0.95, 0.1, 0.2, 0.9, 0.85, 0.15, 0.9, 0.2, 0.9], ys: [0.75, 0.85, 0.9, 0.8, 0.7, 0.9, 0.85, 0.95, 0.8] },
] as const;

function Blob({
  index,
  step,
  drift,
  width,
  height,
}: {
  index: number;
  step: SharedValue<number>;
  drift: SharedValue<number>;
  width: number;
  height: number;
}) {
  const blob = BLOBS[index];
  const steps = blob.xs.map((_, i) => i);
  const xs = [...blob.xs];
  const ys = [...blob.ys];
  const animatedProps = useAnimatedProps(() => {
    const wobble = drift.value * Math.PI * 2 + index * 2;
    return {
      cx: interpolate(step.value, steps, xs) * width + Math.sin(wobble) * 24,
      cy: interpolate(step.value, steps, ys) * height + Math.cos(wobble) * 18,
    };
  });
  return (
    <AnimatedCircle
      r={Math.max(width, height) * blob.r * 0.6}
      fill={`url(#glow${index})`}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Soft glows behind the whole flow. They glide to a new place at every step
 * and breathe slowly in between, so the screen never feels static.
 */
export function AmbientBackground({ step }: { step: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const stepValue = useSharedValue(step);
  const drift = useSharedValue(0);

  useEffect(() => {
    stepValue.value = reduceMotion
      ? step
      : withTiming(step, { duration: 1400, easing: Easing.inOut(Easing.cubic) });
  }, [reduceMotion, step, stepValue]);

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
  }, [drift, reduceMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          {BLOBS.map((blob, i) => (
            <RadialGradient key={i} id={`glow${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme[blob.color]} stopOpacity={0.2} />
              <Stop offset="1" stopColor={theme[blob.color]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {BLOBS.map((_, i) => (
          <Blob key={i} index={i} step={stepValue} drift={drift} width={width} height={height} />
        ))}
      </Svg>
    </View>
  );
}

/** Rounded surface used for cards inside the steps. */
export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  headerCenter: { alignItems: 'center' },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1.4 },
  title: { fontSize: 28, lineHeight: 35, fontWeight: 800, letterSpacing: -0.4 },
  body: { fontSize: 15.5, lineHeight: 23, maxWidth: 380 },
  counter: { padding: 0, margin: 0, fontVariant: ['tabular-nums'] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  bubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  optionTitle: { fontSize: 16, lineHeight: 21, fontWeight: 700 },
  optionDesc: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: 700 },
  checkSlot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  emptyCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  card: { borderRadius: 24, padding: Spacing.four },
});
