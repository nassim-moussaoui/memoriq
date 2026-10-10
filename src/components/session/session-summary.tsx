import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Celebration } from '@/components/celebration';
import { Confetti } from '@/components/confetti';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function enter(index: number) {
  return FadeInDown.delay(250 + index * 90).springify().damping(18);
}

function StatTile({
  index,
  icon,
  value,
  label,
  color,
}: {
  index: number;
  icon: IconName;
  value: string;
  label: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={enter(index)}
      style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
      <ThemedText style={[styles.tileLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </Animated.View>
  );
}

function ActionRow({
  index,
  icon,
  label,
  tinted,
  onPress,
}: {
  index: number;
  icon: IconName;
  label: string;
  tinted?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = tinted ? theme.tint : theme.text;
  return (
    <Animated.View entering={enter(index)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: tinted ? theme.tintSoft : theme.backgroundElement,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}>
        <Ionicons name={icon} size={18} color={tinted ? theme.tint : theme.info} />
        <ThemedText type="smallBold" style={[styles.actionText, { color }]}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={tinted ? theme.tint : theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

/** End of session: celebration, what was done, what comes next. */
export function SessionSummary({
  empty,
  newCount,
  reviewCount,
  successRate,
  chainCount = 0,
  streak,
  nextDueText,
  remainingDue,
  reminderOffer,
  completedSurahs = [],
  versesMilestone = null,
  streakMilestone = null,
  onContinue,
  onEnableReminders,
  onClose,
}: {
  /** The session opened with nothing to do. */
  empty: boolean;
  newCount: number;
  reviewCount: number;
  /** Share of verses recited right on the first try, 0 to 1 (null if none). */
  successRate: number | null;
  /** Passages recited in one go (chain steps) during the session. */
  chainCount?: number;
  streak: number;
  nextDueText: string | null;
  remainingDue: number;
  /** Reminder time to offer, or null when reminders are already on. */
  reminderOffer: string | null;
  /** Surahs whose last verse was learned in this session. */
  completedSurahs?: { arabic: string; name: string; verses: number }[];
  /** Learned-verses milestone crossed in this session (10, 50, 100...). */
  versesMilestone?: number | null;
  /** Streak milestone reached today (7, 30...). */
  streakMilestone?: number | null;
  onContinue: () => void;
  onEnableReminders: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const surah = completedSurahs[0];
  const party = !!surah || versesMilestone !== null || streakMilestone !== null;

  // A big moment gets a double "success" tap.
  useEffect(() => {
    if (!party) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const timer = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 350);
    return () => clearTimeout(timer);
  }, [party]);

  let action = 4;
  return (
    <View style={styles.wrap}>
      {party ? <Confetti /> : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {surah ? (
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.surahBadge}>
            <View style={[styles.surahRing, { borderColor: '#E8C468' }]}>
              <Text style={[styles.surahArabic, { color: theme.text }]}>{surah.arabic}</Text>
            </View>
          </Animated.View>
        ) : empty ? (
          <Ionicons name="checkmark-done-circle" size={72} color={theme.tint} />
        ) : (
          <Celebration />
        )}
        <Animated.View entering={enter(0)} style={styles.titleBlock}>
          <ThemedText style={styles.title}>
            {surah ? t('celebrate.surahTitle') : empty ? t('session.emptyTitle') : t('session.doneTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {surah
              ? t('celebrate.surahBody', { name: surah.name, count: surah.verses })
              : empty
                ? t('session.emptyBody')
                : t('session.doneBody')}
          </ThemedText>
          {completedSurahs.length > 1 ? (
            <ThemedText type="small" style={{ color: theme.tint }}>
              {t('celebrate.moreSurahs', { count: completedSurahs.length - 1 })}
            </ThemedText>
          ) : null}
        </Animated.View>

        {versesMilestone !== null || streakMilestone !== null ? (
          <View style={styles.medals}>
            {versesMilestone !== null ? (
              <Animated.View
                entering={ZoomIn.delay(300).springify().damping(12)}
                style={[styles.medal, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="medal" size={22} color="#D9A53A" />
                <ThemedText style={styles.medalText}>
                  {t('celebrate.versesMilestone', { count: versesMilestone })}
                </ThemedText>
              </Animated.View>
            ) : null}
            {streakMilestone !== null ? (
              <Animated.View
                entering={ZoomIn.delay(420).springify().damping(12)}
                style={[styles.medal, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="flame" size={22} color={theme.warning} />
                <ThemedText style={styles.medalText}>
                  {t('celebrate.streakMilestone', { count: streakMilestone })}
                </ThemedText>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        {!empty ? (
          <View style={styles.tiles}>
            <StatTile
              index={1}
              icon="sparkles-outline"
              value={`${newCount}`}
              label={t('session.statNew', { count: newCount })}
              color={theme.tint}
            />
            <StatTile
              index={2}
              icon="refresh-outline"
              value={`${reviewCount}`}
              label={t('session.statReviews', { count: reviewCount })}
              color={theme.info}
            />
            <StatTile
              index={3}
              icon="flame-outline"
              value={`${streak}`}
              label={t('session.statStreak', { count: streak })}
              color={theme.warning}
            />
          </View>
        ) : null}

        {successRate !== null ? (
          <Animated.View entering={enter(4)} style={[styles.note, { backgroundColor: theme.tintSoft }]}>
            <Ionicons name="trending-up-outline" size={18} color={theme.tint} />
            <ThemedText type="small" style={[styles.noteText, { color: theme.tint }]}>
              {t('session.successRate', { percent: Math.round(successRate * 100) })}
            </ThemedText>
          </Animated.View>
        ) : null}

        {chainCount > 0 ? (
          <Animated.View entering={enter(4)} style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="link" size={18} color={theme.warning} />
            <ThemedText type="small" style={styles.noteText}>
              {t('session.chainsDone', { count: chainCount })}
            </ThemedText>
          </Animated.View>
        ) : null}

        {nextDueText ? (
          <Animated.View entering={enter(5)} style={styles.nextRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noteText}>
              {nextDueText}
            </ThemedText>
          </Animated.View>
        ) : null}

        <View style={styles.actions}>
          {remainingDue > 0 ? (
            <ActionRow
              index={action++}
              icon="play-forward-outline"
              label={t('session.moreWaiting', { count: remainingDue })}
              onPress={onContinue}
            />
          ) : null}
          {reminderOffer ? (
            <ActionRow
              index={action++}
              icon="notifications-outline"
              label={t('notif.optIn', { time: reminderOffer })}
              tinted
              onPress={onEnableReminders}
            />
          ) : null}
        </View>

        {!empty ? (
          <Animated.View entering={enter(action + 1)} style={styles.science}>
            <Ionicons name="school-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noteText}>
              {t('session.doneScience')}
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label={t('session.backHome')} icon="home-outline" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  surahBadge: { alignItems: 'center' },
  surahRing: {
    minWidth: 132,
    height: 132,
    paddingHorizontal: Spacing.three,
    borderRadius: 66,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahArabic: { fontSize: 38, lineHeight: 68, writingDirection: 'rtl' },
  medals: { alignSelf: 'stretch', gap: Spacing.two },
  medal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  medalText: { flex: 1, fontSize: 15.5, lineHeight: 20, fontWeight: 700 },
  titleBlock: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 35, fontWeight: 800, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  tiles: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  tileValue: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  tileLabel: { fontSize: 11.5, lineHeight: 15, textAlign: 'center', fontWeight: 500 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.three,
    alignSelf: 'stretch',
  },
  noteText: { flex: 1 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  actions: { gap: Spacing.two, alignSelf: 'stretch' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.three,
  },
  actionText: { flex: 1 },
  science: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.one,
  },
  footer: { paddingVertical: Spacing.three },
});
