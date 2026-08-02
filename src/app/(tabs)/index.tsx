import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getChapter } from '@/lib/quran';
import { buildSessionPlan, type SessionPlan } from '@/lib/srs/queue';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeSurah = useAppStore((s) => s.activeSurah);
  const streak = useAppStore((s) => s.streak);
  const [plan, setPlan] = useState<SessionPlan | null>(null);

  useFocusEffect(
    useCallback(() => {
      setPlan(buildSessionPlan(activeSurah));
    }, [activeSurah])
  );

  const chapter = getChapter(activeSurah);
  const chapterName = i18n.language === 'fr' ? chapter.nameFr : chapter.nameEn;
  const newCount = plan?.newItems.length ?? 0;
  const reviewCount = plan?.reviewItems.length ?? 0;
  const hasWork = newCount + reviewCount > 0;
  const estimatedMinutes = Math.max(1, Math.ceil(newCount * 1.5 + reviewCount * 0.5));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{t('today.greeting')}</ThemedText>
          {streak > 0 && (
            <View style={[styles.streakChip, { backgroundColor: theme.tintSoft }]}>
              <Ionicons name="flame" size={16} color={theme.tint} />
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                {t('today.streak', { count: streak })}
              </ThemedText>
            </View>
          )}
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
            <ThemedText type="default">{t('today.allDone')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('today.allDoneHint')}
            </ThemedText>
          </ThemedView>
        )}

        <View style={styles.tipRow}>
          <Ionicons name="moon-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('today.eveningTip')}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    paddingTop: Spacing.three,
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
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
});
