import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ForgettingCurveChart,
  SpacedRepetitionChart,
  TestingEffectChart,
} from '@/components/onboarding-charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getChapter } from '@/lib/quran';
import { useAppStore, type Level } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

const SLIDE_COUNT = 5;
const STARTER_SURAHS = [1, 114, 113, 112, 110, 108];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const [page, setPage] = useState(0);

  const alreadyCompleted = useAppStore((s) => s.onboardingCompleted);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [level, setLevel] = useState<Level>('beginner');
  const [minutesPerDay, setMinutesPerDay] = useState<5 | 10 | 20>(10);
  const [surah, setSurah] = useState(114);

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setPage(index);
  };

  const finish = () => {
    completeOnboarding({ level, minutesPerDay, activeSurah: surah });
    router.replace('/');
  };

  const skip = () => {
    if (alreadyCompleted) router.back();
    else goTo(SLIDE_COUNT - 1);
  };

  const chip = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected ? theme.tintSoft : theme.backgroundElement,
      borderColor: selected ? theme.tint : 'transparent',
    },
  ];

  const renderSlide = ({ item }: { item: number }) => {
    const slideStyle = { width: Math.min(width, MaxContentWidth) };
    if (item === 0) {
      return (
        <View style={[styles.slide, slideStyle]}>
          <ForgettingCurveChart daysLabel={t('onboarding.slide1Caption')} />
          <ThemedText type="subtitle" style={styles.center}>
            {t('onboarding.slide1Title')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('onboarding.slide1Body')}
          </ThemedText>
        </View>
      );
    }
    if (item === 1) {
      return (
        <View style={[styles.slide, slideStyle]}>
          <SpacedRepetitionChart
            daysLabel={t('onboarding.slide2Caption')}
            withLabel="Memoriq"
            withoutLabel={t('onboarding.slide1Caption')}
          />
          <ThemedText type="subtitle" style={styles.center}>
            {t('onboarding.slide2Title')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('onboarding.slide2Body')}
          </ThemedText>
        </View>
      );
    }
    if (item === 2) {
      return (
        <View style={[styles.slide, slideStyle]}>
          <TestingEffectChart
            rereadLabel={t('onboarding.slide3Reread')}
            retrievalLabel={t('onboarding.slide3Retrieval')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('onboarding.slide3Caption')}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.center}>
            {t('onboarding.slide3Title')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('onboarding.slide3Body')}
          </ThemedText>
        </View>
      );
    }
    if (item === 3) {
      const rows = [
        { icon: 'sparkles-outline' as const, label: t('onboarding.slide4Sabaq') },
        { icon: 'refresh-outline' as const, label: t('onboarding.slide4Sabqi') },
        { icon: 'library-outline' as const, label: t('onboarding.slide4Manzil') },
      ];
      return (
        <View style={[styles.slide, slideStyle]}>
          <ThemedText type="subtitle" style={styles.center}>
            {t('onboarding.slide4Title')}
          </ThemedText>
          <View style={styles.hifzRows}>
            {rows.map((row) => (
              <ThemedView key={row.icon} type="backgroundElement" style={styles.hifzRow}>
                <Ionicons name={row.icon} size={20} color={theme.tint} />
                <ThemedText type="small" style={{ flex: 1 }}>
                  {row.label}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('onboarding.slide4Body')}
          </ThemedText>
        </View>
      );
    }
    // Setup page
    return (
      <View style={[styles.slide, styles.setupSlide, slideStyle]}>
        <ThemedText type="subtitle" style={styles.center}>
          {t('onboarding.setupTitle')}
        </ThemedText>

        <ThemedText type="smallBold">{t('onboarding.levelLabel')}</ThemedText>
        <View style={styles.chipRow}>
          {(
            [
              ['beginner', t('onboarding.levelBeginner')],
              ['intermediate', t('onboarding.levelIntermediate')],
              ['advanced', t('onboarding.levelAdvanced')],
            ] as const
          ).map(([value, label]) => (
            <Pressable key={value} style={chip(level === value)} onPress={() => setLevel(value)}>
              <ThemedText type="small" style={level === value ? { color: theme.tint } : undefined}>
                {label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="smallBold">{t('onboarding.timeLabel')}</ThemedText>
        <View style={styles.chipRow}>
          {([5, 10, 20] as const).map((m) => (
            <Pressable key={m} style={chip(minutesPerDay === m)} onPress={() => setMinutesPerDay(m)}>
              <ThemedText
                type="small"
                style={minutesPerDay === m ? { color: theme.tint } : undefined}>
                {t('onboarding.minutes', { count: m })}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="smallBold">{t('onboarding.surahLabel')}</ThemedText>
        <View style={styles.chipRow}>
          {STARTER_SURAHS.map((id) => {
            const c = getChapter(id);
            return (
              <Pressable key={id} style={chip(surah === id)} onPress={() => setSurah(id)}>
                <ThemedText type="small" style={surah === id ? { color: theme.tint } : undefined}>
                  {c.nameSimple}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const isLast = page === SLIDE_COUNT - 1;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable onPress={skip} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('onboarding.skip')}
            </ThemedText>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={[0, 1, 2, 3, 4]}
          keyExtractor={(n) => String(n)}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const slideWidth = Math.min(width, MaxContentWidth);
            setPage(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
          }}
        />

        <View style={styles.dots}>
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? theme.tint : theme.backgroundSelected },
              ]}
            />
          ))}
        </View>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.tint }]}
          onPress={() => (isLast ? finish() : goTo(page + 1))}>
          <ThemedText type="default" style={styles.primaryButtonText}>
            {isLast ? t('onboarding.start') : t('onboarding.next')}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  setupSlide: { justifyContent: 'flex-start', alignItems: 'stretch', paddingTop: Spacing.four },
  center: { textAlign: 'center' },
  hifzRows: { alignSelf: 'stretch', gap: Spacing.two },
  hifzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  primaryButton: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
});
