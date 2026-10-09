import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Rating, type Grade } from '@/lib/srs/scheduler';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Turns a scheduled interval into words a learner understands. "Again" is
 * always retried right away in the session, so it gets its own label.
 */
function useDescribeReturn() {
  const { t } = useTranslation();
  return (grade: Grade, minutes: number): string => {
    if (grade === Rating.Again) return t('session.returnNow');
    const days = Math.max(1, Math.round(minutes / 1440));
    if (days === 1) return t('session.returnTomorrow');
    if (days < 14) return t('session.returnDays', { count: days });
    if (days < 60) return t('session.returnWeeks', { count: Math.round(days / 7) });
    if (days < 365) return t('session.returnMonths', { count: Math.round(days / 30) });
    return t('session.returnYears', { count: Math.round(days / 365) });
  };
}

function RatingCard({
  index,
  icon,
  color,
  label,
  desc,
  when,
  onPress,
}: {
  index: number;
  icon: IconName;
  color: string;
  label: string;
  desc: string;
  when?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.95]) }],
  }));
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).springify().damping(18)}
      style={styles.cell}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${desc}. ${when ?? ''}`}
        onPressIn={() => {
          pressed.set(withTiming(1, { duration: 80 }));
        }}
        onPressOut={() => {
          pressed.set(withSpring(0, { damping: 12, stiffness: 260 }));
        }}
        onPress={onPress}
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: color + '55' },
          animatedStyle,
        ]}>
        <View style={styles.cardTop}>
          <View style={[styles.icon, { backgroundColor: color + '22' }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <ThemedText style={[styles.label, { color }]} numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
        <ThemedText style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
          {desc}
        </ThemedText>
        {when ? (
          <View style={[styles.when, { backgroundColor: theme.background }]}>
            <Ionicons name="calendar-clear-outline" size={11} color={theme.textSecondary} />
            <ThemedText style={[styles.whenText, { color: theme.text }]} numberOfLines={1}>
              {when}
            </ThemedText>
          </View>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * Self-evaluation after reciting. Instead of Anki's abstract buttons, each
 * choice says what happened ("I forgot it") and when the verse will be back.
 */
export function RatingGrid({
  intervals,
  onRate,
}: {
  intervals: Record<Grade, number> | null;
  onRate: (grade: Grade) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const describe = useDescribeReturn();
  const options: { grade: Grade; icon: IconName; color: string; key: string }[] = [
    { grade: Rating.Again, icon: 'refresh', color: theme.danger, key: 'again' },
    { grade: Rating.Hard, icon: 'help-circle-outline', color: theme.warning, key: 'hard' },
    { grade: Rating.Good, icon: 'checkmark-circle-outline', color: theme.tint, key: 'good' },
    { grade: Rating.Easy, icon: 'star-outline', color: theme.info, key: 'easy' },
  ];
  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.question}>{t('session.rateQuestion')}</ThemedText>
      <View style={styles.grid}>
        {options.map((o, i) => (
          <RatingCard
            key={o.key}
            index={i}
            icon={o.icon}
            color={o.color}
            label={t(`session.rate_${o.key}`)}
            desc={t(`session.rate_${o.key}Desc`)}
            when={intervals ? describe(o.grade, intervals[o.grade]) : undefined}
            onPress={() => {
              void (o.grade === Rating.Again
                ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
              onRate(o.grade);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  question: { fontSize: 15, lineHeight: 20, fontWeight: 700, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { flexBasis: '48%', flexGrow: 1 },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
    paddingVertical: 12,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: 800 },
  desc: { fontSize: 12.5, lineHeight: 16, minHeight: 32 },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  whenText: { fontSize: 11.5, lineHeight: 15, fontWeight: 700 },
});
