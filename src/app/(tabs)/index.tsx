import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getChapter } from '@/lib/quran';
import { getNextDueAt } from '@/lib/srs/db';
import { buildSessionPlan, type SessionPlan } from '@/lib/srs/queue';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

type NextDue = { kind: 'today' | 'tomorrow' | 'date'; value: string };

/** Human description of the next scheduled review (called from effects only). */
function describeNextDue(ts: number, locale: string): NextDue {
  const due = new Date(ts);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((ts - startOfToday.getTime()) / 86_400_000);
  if (dayDiff <= 1) {
    const time = due.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return { kind: dayDiff <= 0 ? 'today' : 'tomorrow', value: time };
  }
  return {
    kind: 'date',
    value: due.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeSurah = useAppStore((s) => s.activeSurah);
  const streak = useAppStore((s) => s.streak);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [nextDue, setNextDue] = useState<NextDue | null>(null);

  useFocusEffect(
    useCallback(() => {
      const built = buildSessionPlan(activeSurah);
      setPlan(built);
      if (built.newItems.length + built.reviewItems.length === 0) {
        const ts = getNextDueAt();
        setNextDue(ts ? describeNextDue(ts, i18n.language) : null);
      } else {
        setNextDue(null);
      }
    }, [activeSurah, i18n.language])
  );

  const chapter = getChapter(activeSurah);
  const chapterName = i18n.language === 'fr' ? chapter.nameFr : chapter.nameEn;
  const newCount = plan?.newItems.length ?? 0;
  const reviewCount = plan?.reviewItems.length ?? 0;
  const hasWork = newCount + reviewCount > 0;
  const estimatedMinutes = Math.max(1, Math.ceil(newCount * 1.5 + reviewCount * 0.5));

  const streakColor = streak > 0 ? theme.tint : theme.textSecondary;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{t('today.greeting')}</ThemedText>
          <View
            style={[
              styles.streakChip,
              { backgroundColor: streak > 0 ? theme.tintSoft : theme.backgroundElement },
            ]}>
            <Ionicons name="flame" size={16} color={streakColor} />
            <ThemedText type="smallBold" style={{ color: streakColor }}>
              {streak > 0 ? t('today.streak', { count: streak }) : t('today.streakStart')}
            </ThemedText>
          </View>
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('today.activeSurah')}
          </ThemedText>
          <View style={styles.surahRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="default">
                {chapter.id}. {chapter.nameSimple}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {chapterName}
              </ThemedText>
            </View>
            <ThemedText style={styles.surahArabic}>{chapter.nameArabic}</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/library')} hitSlop={8}>
            <ThemedText type="linkPrimary">{t('today.changeSurah')}</ThemedText>
          </Pressable>
        </ThemedView>

        {hasWork ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="default">{t('today.sessionReady')}</ThemedText>
            <View style={styles.countsRow}>
              {newCount > 0 && (
                <View style={styles.countItem}>
                  <Ionicons name="sparkles-outline" size={18} color={theme.tint} />
                  <ThemedText type="small">{t('today.newVerses', { count: newCount })}</ThemedText>
                </View>
              )}
              {reviewCount > 0 && (
                <View style={styles.countItem}>
                  <Ionicons name="refresh-outline" size={18} color={theme.info} />
                  <ThemedText type="small">{t('today.reviews', { count: reviewCount })}</ThemedText>
                </View>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {t('today.estimated', { minutes: estimatedMinutes })}
              </ThemedText>
            </View>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
              onPress={() => router.push('/session')}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                {t('today.start')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.doneHeader}>
              <Ionicons name="checkmark-circle" size={22} color={theme.tint} />
              <ThemedText type="default" style={{ flex: 1 }}>
                {t('today.allDone')}
              </ThemedText>
            </View>
            {nextDue && (
              <ThemedText type="small" themeColor="textSecondary">
                {nextDue.kind === 'today'
                  ? t('today.nextDueToday', { time: nextDue.value })
                  : nextDue.kind === 'tomorrow'
                    ? t('today.nextDueTomorrow', { time: nextDue.value })
                    : t('today.nextDueOn', { date: nextDue.value })}
              </ThemedText>
            )}
            <View style={styles.doneActions}>
              <Pressable
                style={[styles.softButton, { backgroundColor: theme.tintSoft }]}
                onPress={() => router.push(`/surah/${activeSurah}`)}>
                <Ionicons name="book-outline" size={16} color={theme.tint} />
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  {t('today.readSurah')}
                </ThemedText>
              </Pressable>
              {nextDue && (
                <Pressable
                  style={[styles.softButton, { backgroundColor: theme.tintSoft }]}
                  onPress={() => router.push({ pathname: '/session', params: { mode: 'ahead' } })}>
                  <Ionicons name="play-forward-outline" size={16} color={theme.tint} />
                  <ThemedText type="smallBold" style={{ color: theme.tint }}>
                    {t('today.reviewAhead')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <Pressable onPress={() => router.push('/library')} hitSlop={8}>
              <ThemedText type="linkPrimary">{t('today.explore')}</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <View style={styles.tipRow}>
          <Ionicons name="moon-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('today.eveningTip')}
          </ThemedText>
        </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  surahRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  surahArabic: { fontSize: 26, lineHeight: 40 },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  doneActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  softButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
});
