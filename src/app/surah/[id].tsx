import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpeedPill } from '@/components/speed-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getChapter, getVerses, isFreeSurah, type Verse } from '@/lib/quran';
import { getSurahStatuses, type VerseStatus } from '@/lib/srs/db';
import {
  countUnstartedVerses,
  getKnownAyahs,
  markSurahsKnown,
  unmarkSurahKnown,
} from '@/lib/srs/known';
import { buildChainQueue, nextSegment } from '@/lib/srs/queue';
import { confirmSurahSwitch } from '@/lib/surah-switch';
import { useAppStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { useAyahAudio, type PlayingAyah } from '@/lib/use-ayah-audio';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Surahs whose text opens without a separate basmala line. */
const NO_BASMALA = new Set([1, 9]);
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export default function SurahScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surahId = Number(id);
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isPremium = useAppStore((s) => s.isPremium);
  const showTranslation = useAppStore((s) => s.showTranslation);
  const showTransliteration = useAppStore((s) => s.showTransliteration);
  const arabicFontScale = useAppStore((s) => s.arabicFontScale);
  const activeSurah = useAppStore((s) => s.activeSurah);
  const setActiveSurah = useAppStore((s) => s.setActiveSurah);

  const [playAll, setPlayAll] = useState(false);
  const [loop, setLoop] = useState(false);
  const [statuses, setStatuses] = useState<Map<number, VerseStatus>>(new Map());
  const [chainable, setChainable] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const loopRef = useRef(false);
  const playAllRef = useRef(false);
  const listRef = useRef<FlatList<Verse>>(null);

  const valid = Number.isInteger(surahId) && surahId >= 1 && surahId <= 114;

  useFocusEffect(
    useCallback(() => {
      if (!valid) return;
      setStatuses(getSurahStatuses(surahId));
      setChainable(buildChainQueue(surahId).length);
      setKnownCount(getKnownAyahs(surahId).length);
    }, [surahId, valid]),
  );

  const onAyahFinishedRef = useRef<(played: PlayingAyah) => void>(() => {});
  const { play, stop, playing } = useAyahAudio((played) => onAyahFinishedRef.current(played));

  useEffect(() => {
    onAyahFinishedRef.current = (played) => {
      if (!playAllRef.current) return;
      const nextAyah = played.ayah + 1;
      if (nextAyah <= getChapter(played.surah).versesCount) {
        play(surahId, nextAyah);
        listRef.current?.scrollToIndex({ index: nextAyah - 1, viewPosition: 0.3 });
      } else if (loopRef.current) {
        play(surahId, 1);
        listRef.current?.scrollToIndex({ index: 0, viewPosition: 0.3 });
      } else {
        playAllRef.current = false;
        setPlayAll(false);
      }
    };
  });

  // Guards before touching the dataset: a malformed id redirects to the
  // library, and locked surahs never load their verses into memory.
  if (!valid) return <Redirect href="/library" />;
  if (!isFreeSurah(surahId) && !isPremium) return <Redirect href="/paywall" />;

  const chapter = getChapter(surahId);
  const verses = getVerses(surahId);
  const isFr = i18n.language === 'fr';

  const startPlayAll = () => {
    playAllRef.current = true;
    setPlayAll(true);
    play(surahId, 1);
  };

  const stopAll = () => {
    playAllRef.current = false;
    setPlayAll(false);
    stop();
  };

  const toggleLoop = () => {
    loopRef.current = !loopRef.current;
    setLoop(loopRef.current);
  };

  const startLearning = () => {
    confirmSurahSwitch(activeSurah, surahId, () => {
      setActiveSurah(surahId);
      stopAll();
      router.push({ pathname: '/session', params: { mode: 'learn' } });
    });
  };

  const reviewDue = () => {
    stopAll();
    router.push('/session');
  };

  const refreshState = () => {
    setStatuses(getSurahStatuses(surahId));
    setChainable(buildChainQueue(surahId).length);
    setKnownCount(getKnownAyahs(surahId).length);
  };

  const markKnown = () => {
    const verses = countUnstartedVerses([surahId]);
    Alert.alert(
      t('known.confirmTitle', { count: 1 }),
      t('known.confirmBody', { count: verses }),
      [
        { text: t('auth.cancel'), style: 'cancel' },
        {
          text: t('known.confirmCta'),
          onPress: () => {
            markSurahsKnown([surahId]);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refreshState();
          },
        },
      ],
    );
  };

  const unmarkKnown = () => {
    Alert.alert(t('known.undoTitle'), t('known.undoBody', { count: knownCount }), [
      { text: t('auth.cancel'), style: 'cancel' },
      {
        text: t('known.undoCta'),
        style: 'destructive',
        onPress: () => {
          unmarkSurahKnown(surahId);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refreshState();
          syncNow().catch(() => {});
        },
      },
    ]);
  };

  const learned = [...statuses.values()].filter((s) => s === 'learned').length;
  const due = [...statuses.values()].filter((s) => s === 'due').length;
  const started = statuses.size;
  const hasNextSegment = nextSegment(surahId) !== null;

  const statusMeta: Record<VerseStatus, { label: string; color: string; icon: IconName }> = {
    learned: { label: t('surah.statusLearned'), color: theme.tint, icon: 'checkmark-circle' },
    learning: { label: t('surah.statusLearning'), color: theme.warning, icon: 'ellipse-outline' },
    due: { label: t('surah.statusDue'), color: theme.info, icon: 'refresh-circle' },
  };

  const header = (
    <View style={styles.hero}>
      <Text style={[styles.heroArabic, { color: theme.text }]}>{chapter.nameArabic}</Text>
      <ThemedText style={styles.heroName}>{chapter.nameSimple}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {`${isFr ? chapter.nameFr : chapter.nameEn} · ${t(
          chapter.revelationPlace === 'makkah' ? 'surah.makkah' : 'surah.madinah',
        )} · ${t('library.verses', { count: chapter.versesCount })}`}
      </ThemedText>

      {started > 0 ? (
        <View style={[styles.progressCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: theme.tint + '55', width: `${(started / chapter.versesCount) * 100}%` },
              ]}
            />
            <View
              style={[
                styles.trackFill,
                styles.overlay,
                { backgroundColor: theme.tint, width: `${(learned / chapter.versesCount) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.legendRow}>
            {(['learned', 'learning', 'due'] as const).map((k) => {
              const n = [...statuses.values()].filter((s) => s === k).length;
              if (n === 0) return null;
              return (
                <View key={k} style={styles.legendItem}>
                  <Ionicons name={statusMeta[k].icon} size={13} color={statusMeta[k].color} />
                  <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
                    {`${n} ${statusMeta[k].label.toLowerCase()}`}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={playAll ? stopAll : startPlayAll}
          style={({ pressed }) => [
            styles.controlButton,
            { backgroundColor: playAll ? theme.tint : theme.tintSoft, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}>
          <Ionicons name={playAll ? 'stop' : 'play'} size={15} color={playAll ? '#ffffff' : theme.tint} />
          <ThemedText type="smallBold" style={{ color: playAll ? '#ffffff' : theme.tint }}>
            {playAll ? t('surah.stop') : t('surah.listen')}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: loop }}
          onPress={toggleLoop}
          style={({ pressed }) => [
            styles.controlButton,
            {
              backgroundColor: loop ? theme.tintSoft : theme.backgroundElement,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}>
          <Ionicons name="repeat" size={15} color={loop ? theme.tint : theme.textSecondary} />
          <ThemedText type="smallBold" style={{ color: loop ? theme.tint : theme.textSecondary }}>
            {t('surah.loop')}
          </ThemedText>
        </Pressable>
        <SpeedPill />
      </View>

      {chainable > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            stopAll();
            router.push({ pathname: '/session', params: { mode: 'chain', surah: String(surahId) } });
          }}
          style={({ pressed }) => [
            styles.chainCard,
            { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}>
          <View style={[styles.chainIcon, { backgroundColor: theme.warning + '22' }]}>
            <Ionicons name="link" size={18} color={theme.warning} />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.chainTitle}>{t('chain.practiceTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chainDesc}>
              {t('chain.practiceDesc', { count: chainable })}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {hasNextSegment ? (
        <Pressable
          accessibilityRole="button"
          onPress={markKnown}
          style={({ pressed }) => [
            styles.chainCard,
            { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}>
          <View style={[styles.chainIcon, { backgroundColor: theme.tint + '22' }]}>
            <Ionicons name="checkmark-done" size={18} color={theme.tint} />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.chainTitle}>{t('known.readerTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chainDesc}>
              {t('known.readerDesc')}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {knownCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={unmarkKnown}
          style={({ pressed }) => [
            styles.chainCard,
            { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}>
          <View style={[styles.chainIcon, { backgroundColor: theme.danger + '22' }]}>
            <Ionicons name="arrow-undo" size={18} color={theme.danger} />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.chainTitle}>{t('known.undoRowTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chainDesc}>
              {t('known.undoRowDesc', { count: knownCount })}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {!NO_BASMALA.has(surahId) ? (
        <Text style={[styles.basmala, { color: theme.textSecondary }]}>{BASMALA}</Text>
      ) : null}
    </View>
  );

  const renderVerse = ({ item }: { item: Verse }) => {
    const isPlaying = playing?.ayah === item.v && playing?.surah === surahId;
    const status = statuses.get(item.v);
    const meta = status ? statusMeta[status] : null;
    return (
      <View
        style={[
          styles.verseCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: isPlaying ? theme.tint : 'transparent',
          },
        ]}>
        <View style={styles.verseHeader}>
          <View style={[styles.ayahBadge, { borderColor: meta?.color ?? theme.backgroundSelected }]}>
            <ThemedText style={[styles.ayahNumber, meta && { color: meta.color }]}>{item.v}</ThemedText>
          </View>
          {meta ? (
            <View style={[styles.statusChip, { backgroundColor: meta.color + '1F' }]}>
              <Ionicons name={meta.icon} size={12} color={meta.color} />
              <ThemedText style={[styles.statusText, { color: meta.color }]}>{meta.label}</ThemedText>
            </View>
          ) : null}
          <View style={styles.flex} />
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('a11y.pause') : t('a11y.playVerse')}
            onPress={() => {
              if (isPlaying) {
                stopAll();
              } else {
                playAllRef.current = false;
                setPlayAll(false);
                play(surahId, item.v);
              }
            }}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: isPlaying ? theme.tint : theme.background, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color={isPlaying ? '#ffffff' : theme.tint} />
          </Pressable>
        </View>
        <Text
          style={[
            styles.arabic,
            {
              color: theme.text,
              fontSize: 26 * arabicFontScale,
              lineHeight: 26 * arabicFontScale * 1.85,
            },
          ]}>
          {item.ar.trim()}
        </Text>
        {showTransliteration ? (
          <ThemedText style={[styles.translit, { color: theme.tint }]}>{item.tr}</ThemedText>
        ) : null}
        {showTranslation ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.translation}>
            {isFr ? item.fr : item.en}
          </ThemedText>
        ) : null}
      </View>
    );
  };

  const footer = hasNextSegment ? (
    <PrimaryButton
      label={
        surahId === activeSurah && started > 0 ? t('surah.continue') : t('surah.learn')
      }
      icon="school-outline"
      onPress={startLearning}
    />
  ) : due > 0 ? (
    <PrimaryButton label={t('surah.reviewDue', { count: due })} icon="refresh" onPress={reviewDue} />
  ) : (
    <View style={styles.completed}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {t('surah.completed')}
      </ThemedText>
      <PrimaryButton
        label={t('surah.pickNext')}
        icon="library-outline"
        variant="soft"
        onPress={() => router.push('/library')}
      />
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              stopAll();
              router.back();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.topTitle} numberOfLines={1}>
            {`${chapter.id}. ${chapter.nameSimple}`}
          </ThemedText>
          <View style={styles.roundButton} />
        </View>

        <FlatList
          ref={listRef}
          data={verses}
          keyExtractor={(v) => String(v.v)}
          renderItem={renderVerse}
          extraData={[playing, statuses, showTranslation, showTransliteration, arabicFontScale]}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true });
          }}
        />

        <View style={styles.footer}>{footer}</View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  roundButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: 700 },
  list: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  heroArabic: { fontSize: 44, lineHeight: 80, writingDirection: 'rtl' },
  heroName: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
  progressCard: { alignSelf: 'stretch', borderRadius: 18, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  overlay: { position: 'absolute', top: 0, left: 0 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12.5, lineHeight: 16, fontWeight: 600 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chainCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 18,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  chainIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chainTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: 700 },
  chainDesc: { fontWeight: 400, lineHeight: 18 },
  basmala: { fontSize: 24, lineHeight: 46, writingDirection: 'rtl', marginTop: Spacing.two },
  verseCard: { borderRadius: 22, borderWidth: 1.5, padding: Spacing.three, gap: Spacing.three },
  verseHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ayahBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumber: { fontSize: 12.5, lineHeight: 16, fontWeight: 800, transform: [{ rotate: '-45deg' }] },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 4,
  },
  statusText: { fontSize: 11.5, lineHeight: 15, fontWeight: 700 },
  playButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  arabic: { textAlign: 'right', writingDirection: 'rtl' },
  translit: { fontSize: 14, lineHeight: 21, fontStyle: 'italic', fontWeight: 500 },
  translation: { fontWeight: 400, lineHeight: 21 },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  completed: { gap: Spacing.two },
});

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';
