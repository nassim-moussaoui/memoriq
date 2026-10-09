import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeNextDue, nextDueKey, type NextDue } from '@/lib/next-due';
import { getChapter } from '@/lib/quran';
import { getDailyReviewCounts, getMemorizedCountBySurah, getNextDueAt, getStartedAyahs } from '@/lib/srs/db';
import { buildSessionPlan, estimateMinutes, type SessionPlan } from '@/lib/srs/queue';
import { useAppStore } from '@/lib/store';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Day = { key: string; label: string; active: boolean };

const MOMENT_ICONS: Record<string, IconName> = {
  morning: 'sunny-outline',
  afterPrayer: 'compass-outline',
  evening: 'moon-outline',
};

function enter(index: number) {
  return FadeInDown.delay(index * 70).springify().damping(20);
}

function dayKey(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
    day.getDate(),
  ).padStart(2, '0')}`;
}

/** Number + label column inside the session hero (white on the accent). */
function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText style={styles.heroStatValue}>{value}</ThemedText>
      <ThemedText style={styles.heroStatLabel}>{label}</ThemedText>
    </View>
  );
}

/** Small pill action used inside cards (replaces bare text links). */
function PillButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.background, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      <Ionicons name={icon} size={14} color={theme.tint} />
      <ThemedText style={[styles.pillText, { color: theme.tint }]}>{label}</ThemedText>
    </Pressable>
  );
}

/** Full-width navigation row with an icon bubble and a chevron. */
function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navRow,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <View style={[styles.navIcon, { backgroundColor: theme.tintSoft }]}>
        <Ionicons name={icon} size={18} color={theme.tint} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.navTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.navSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeSurah = useAppStore((s) => s.activeSurah);
  const streak = useAppStore((s) => s.streak);
  const minutesPerDay = useAppStore((s) => s.minutesPerDay);
  const reviewMoment = useAppStore((s) => s.reviewMoment);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [nextDue, setNextDue] = useState<NextDue | null>(null);
  const [week, setWeek] = useState<Day[]>([]);
  const [progress, setProgress] = useState({ started: 0, memorized: 0 });

  useFocusEffect(
    useCallback(() => {
      const built = buildSessionPlan(activeSurah, minutesPerDay);
      setPlan(built);
      if (built.newItems.length + built.reviewItems.length === 0) {
        const ts = getNextDueAt();
        setNextDue(ts ? describeNextDue(ts, i18n.language) : null);
      } else {
        setNextDue(null);
      }
      setProgress({
        started: getStartedAyahs(activeSurah).size,
        memorized: getMemorizedCountBySurah().get(activeSurah) ?? 0,
      });

      // Last 7 days of activity, oldest first, today last.
      const counts = getDailyReviewCounts(7);
      const days: Day[] = [];
      for (let offset = 6; offset >= 0; offset--) {
        const day = new Date();
        day.setDate(day.getDate() - offset);
        const key = dayKey(day);
        days.push({
          key,
          label: day.toLocaleDateString(i18n.language, { weekday: 'narrow' }),
          active: (counts.get(key) ?? 0) > 0,
        });
      }
      setWeek(days);
    }, [activeSurah, minutesPerDay, i18n.language]),
  );

  const chapter = getChapter(activeSurah);
  const chapterName = i18n.language === 'fr' ? chapter.nameFr : chapter.nameEn;
  const newCount = plan?.newItems.length ?? 0;
  const reviewCount = plan?.reviewItems.length ?? 0;
  const hasWork = newCount + reviewCount > 0;
  const estimatedMinutes = plan ? estimateMinutes(plan) : 1;
  // Reviews beyond the daily budget: say so instead of implying "all done".
  const extraDue = Math.max(0, (plan?.dueTotal ?? 0) - reviewCount);
  const activeDays = week.filter((d) => d.active).length;
  const today = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={styles.header}>
            <View style={styles.flex}>
              <ThemedText style={[styles.date, { color: theme.textSecondary }]}>
                {today.toUpperCase()}
              </ThemedText>
              <ThemedText style={styles.greeting}>{t('today.greeting')}</ThemedText>
            </View>
            <View
              accessibilityLabel={
                streak > 0 ? t('today.streak', { count: streak }) : t('today.streakStart')
              }
              style={[
                styles.streak,
                { backgroundColor: streak > 0 ? theme.tintSoft : theme.backgroundElement },
              ]}>
              <Ionicons name="flame" size={18} color={streak > 0 ? theme.warning : theme.textSecondary} />
              <ThemedText style={[styles.streakValue, { color: streak > 0 ? theme.text : theme.textSecondary }]}>
                {streak}
              </ThemedText>
            </View>
          </Animated.View>

          {hasWork ? (
            <Animated.View entering={enter(1)} style={[styles.hero, { backgroundColor: theme.tint }]}>
              <View style={styles.heroTop}>
                <View style={styles.flex}>
                  <ThemedText style={styles.heroEyebrow}>{t('today.sessionEyebrow')}</ThemedText>
                  <ThemedText style={styles.heroTitle}>{t('today.sessionReady')}</ThemedText>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons name="book" size={22} color="#ffffff" />
                </View>
              </View>
              <View style={styles.heroStats}>
                {newCount > 0 ? (
                  <HeroStat value={newCount} label={t('today.tileNew', { count: newCount })} />
                ) : null}
                {reviewCount > 0 ? (
                  <HeroStat value={reviewCount} label={t('today.tileReviews', { count: reviewCount })} />
                ) : null}
                <HeroStat value={estimatedMinutes} label={t('today.tileMinutes')} />
              </View>
              {plan?.segment && newCount > 0 ? (
                <ThemedText style={styles.heroNote}>
                  {t('today.segmentPreview', {
                    surah: chapter.nameSimple,
                    from: plan.newItems[0].ayah,
                    to: plan.newItems[plan.newItems.length - 1].ayah,
                  })}
                </ThemedText>
              ) : null}
              {extraDue > 0 ? (
                <ThemedText style={styles.heroNote}>{t('today.moreDue', { count: extraDue })}</ThemedText>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/session')}
                style={({ pressed }) => [styles.heroButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Ionicons name="play" size={18} color={theme.tint} />
                <ThemedText style={[styles.heroButtonText, { color: theme.tint }]}>
                  {t('today.start')}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View
              entering={enter(1)}
              style={[styles.card, styles.doneCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.doneIcon, { backgroundColor: theme.tintSoft }]}>
                <Ionicons name="checkmark-done" size={26} color={theme.tint} />
              </View>
              <ThemedText style={styles.doneTitle}>{t('today.allDone')}</ThemedText>
              {nextDue ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {t(nextDueKey(nextDue.kind), { time: nextDue.value, date: nextDue.value })}
                </ThemedText>
              ) : null}
              <View style={styles.doneActions}>
                {nextDue ? (
                  <PrimaryButton
                    label={t('today.reviewAhead')}
                    icon="play-forward"
                    onPress={() => router.push({ pathname: '/session', params: { mode: 'ahead' } })}
                  />
                ) : null}
                <PrimaryButton
                  label={t('today.readSurah')}
                  icon="book-outline"
                  variant="soft"
                  onPress={() => router.push(`/surah/${activeSurah}`)}
                />
              </View>
            </Animated.View>
          )}

          <Animated.View entering={enter(2)}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/surah/${activeSurah}`)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
              ]}>
              <View style={styles.cardHeader}>
                <ThemedText style={[styles.cardLabel, { color: theme.textSecondary }]}>
                  {t('today.activeSurah').toUpperCase()}
                </ThemedText>
                <PillButton
                  icon="swap-horizontal"
                  label={t('today.changeSurah')}
                  onPress={() => router.push('/library')}
                />
              </View>
              <View style={styles.surahRow}>
                <View style={[styles.surahBadge, { backgroundColor: theme.tintSoft }]}>
                  <ThemedText style={[styles.surahArabic, { color: theme.tint }]}>
                    {chapter.nameArabic}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.surahName}>{chapter.nameSimple}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${chapterName} · ${t('today.versesTotal', { count: chapter.versesCount })}`}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
              <View style={styles.progressBlock}>
                <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        backgroundColor: theme.tint + '55',
                        width: `${(progress.started / chapter.versesCount) * 100}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.trackFill,
                      styles.trackOverlay,
                      {
                        backgroundColor: theme.tint,
                        width: `${(progress.memorized / chapter.versesCount) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                  {t('today.surahProgress', {
                    memorized: progress.memorized,
                    started: progress.started,
                    total: chapter.versesCount,
                  })}
                </ThemedText>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={enter(3)}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={[styles.cardLabel, { color: theme.textSecondary }]}>
                {t('today.thisWeek').toUpperCase()}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                {t('today.weekCount', { count: activeDays })}
              </ThemedText>
            </View>
            <View style={styles.weekRow}>
              {week.map((day, i) => {
                const isToday = i === week.length - 1;
                return (
                  <View key={day.key} style={styles.weekDay}>
                    <View
                      style={[
                        styles.weekDot,
                        {
                          backgroundColor: day.active ? theme.tint : theme.background,
                          borderColor: isToday ? theme.tint : day.active ? theme.tint : theme.backgroundSelected,
                        },
                      ]}>
                      {day.active ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                    </View>
                    <ThemedText
                      style={[
                        styles.weekLabel,
                        { color: isToday ? theme.tint : theme.textSecondary, fontWeight: isToday ? 800 : 600 },
                      ]}>
                      {day.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View entering={enter(4)}>
            <NavRow
              icon="library-outline"
              title={t('today.explore')}
              subtitle={t('today.exploreDesc')}
              onPress={() => router.push('/library')}
            />
          </Animated.View>

          <Animated.View
            entering={enter(5)}
            style={[styles.tip, { borderColor: theme.backgroundSelected }]}>
            <Ionicons name={MOMENT_ICONS[reviewMoment] ?? 'bulb-outline'} size={18} color={theme.tint} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t(`today.tip.${reviewMoment}`)}
            </ThemedText>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.one },
  date: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1 },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: 800, letterSpacing: -0.4 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  streakValue: { fontSize: 16, lineHeight: 20, fontWeight: 800 },
  hero: { borderRadius: 28, padding: Spacing.four, gap: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  heroEyebrow: {
    color: '#ffffffcc',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 1,
  },
  heroTitle: { color: '#ffffff', fontSize: 24, lineHeight: 30, fontWeight: 800 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: { flexDirection: 'row', gap: Spacing.two },
  heroStat: {
    flex: 1,
    backgroundColor: '#ffffff1f',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  heroStatValue: { color: '#ffffff', fontSize: 26, lineHeight: 32, fontWeight: 800 },
  heroStatLabel: {
    color: '#ffffffd9',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: 600,
    textAlign: 'center',
  },
  heroNote: { color: '#ffffffe6', fontSize: 13.5, lineHeight: 19, fontWeight: 500 },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: Spacing.three,
  },
  heroButtonText: { fontSize: 17, lineHeight: 22, fontWeight: 800 },
  card: { borderRadius: 24, padding: Spacing.four, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1 },
  doneCard: { alignItems: 'center' },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 20, lineHeight: 26, fontWeight: 800, textAlign: 'center' },
  doneActions: { alignSelf: 'stretch', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, lineHeight: 17, fontWeight: 700 },
  surahRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  surahBadge: {
    minWidth: 64,
    height: 64,
    borderRadius: 18,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahArabic: { fontSize: 22, lineHeight: 38, writingDirection: 'rtl' },
  surahName: { fontSize: 18, lineHeight: 23, fontWeight: 800 },
  progressBlock: { gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  trackOverlay: { position: 'absolute', top: 0, left: 0 },
  progressText: { fontSize: 12.5, lineHeight: 17, fontWeight: 500 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: { fontSize: 11, lineHeight: 14, textTransform: 'uppercase' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    padding: Spacing.three,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontSize: 16, lineHeight: 21, fontWeight: 700 },
  navSubtitle: { fontWeight: 400, lineHeight: 18 },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
  },
});
