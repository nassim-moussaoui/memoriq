import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getChapter, getVerses, isFreeSurah, type Verse } from '@/lib/quran';
import { nextSegment } from '@/lib/srs/queue';
import { useAppStore } from '@/lib/store';
import { useAyahAudio, type PlayingAyah } from '@/lib/use-ayah-audio';
import { useTheme } from '@/hooks/use-theme';

export default function SurahScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surahId = Number(id);
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isPremium = useAppStore((s) => s.isPremium);
  const showTranslation = useAppStore((s) => s.showTranslation);
  const showTransliteration = useAppStore((s) => s.showTransliteration);
  const arabicFontScale = useAppStore((s) => s.arabicFontScale);
  const setActiveSurah = useAppStore((s) => s.setActiveSurah);

  const [playAll, setPlayAll] = useState(false);
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(false);
  const playAllRef = useRef(false);
  const listRef = useRef<FlatList<Verse>>(null);

  const chapter = getChapter(surahId);
  const verses = getVerses(surahId);

  const onAyahFinishedRef = useRef<(played: PlayingAyah) => void>(() => {});
  const { play, stop, playing } = useAyahAudio((played) => onAyahFinishedRef.current(played));

  useEffect(() => {
    onAyahFinishedRef.current = (played) => {
      if (!playAllRef.current) return;
      const nextAyah = played.ayah + 1;
      if (nextAyah <= chapter.versesCount) {
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

  if (!isFreeSurah(surahId) && !isPremium) {
    return <Redirect href="/paywall" />;
  }

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
    setActiveSurah(surahId);
    stopAll();
    router.push('/session');
  };

  const hasNextSegment = nextSegment(surahId) !== null;

  const renderVerse = ({ item }: { item: Verse }) => {
    const isPlaying = playing?.ayah === item.v && playing?.surah === surahId;
    return (
      <ThemedView type="backgroundElement" style={styles.verseCard}>
        <View style={styles.verseHeader}>
          <View style={[styles.ayahBadge, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{item.v}</ThemedText>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              if (isPlaying) {
                stopAll();
              } else {
                playAllRef.current = false;
                setPlayAll(false);
                play(surahId, item.v);
              }
            }}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={30}
              color={theme.tint}
            />
          </Pressable>
        </View>
        <ThemedText
          style={[
            styles.arabic,
            { fontSize: 26 * arabicFontScale, lineHeight: 48 * arabicFontScale },
          ]}>
          {item.ar}
        </ThemedText>
        {showTransliteration && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.italic}>
            {item.tr}
          </ThemedText>
        )}
        {showTranslation && (
          <ThemedText type="small" themeColor="textSecondary">
            {i18n.language === 'fr' ? item.fr : item.en}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => { stopAll(); router.back(); }} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText type="default">
              {chapter.id}. {chapter.nameSimple}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {i18n.language === 'fr' ? chapter.nameFr : chapter.nameEn} ·{' '}
              {t('library.verses', { count: chapter.versesCount })}
            </ThemedText>
          </View>
          <ThemedText style={styles.headerArabic}>{chapter.nameArabic}</ThemedText>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={[styles.controlButton, { backgroundColor: theme.backgroundElement }]}
            onPress={playAll ? stopAll : startPlayAll}>
            <Ionicons name={playAll ? 'stop' : 'play'} size={16} color={theme.tint} />
            <ThemedText type="smallBold">{playAll ? t('surah.stop') : t('surah.listen')}</ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.controlButton,
              { backgroundColor: loop ? theme.tintSoft : theme.backgroundElement },
            ]}
            onPress={toggleLoop}>
            <Ionicons name="repeat" size={16} color={loop ? theme.tint : theme.textSecondary} />
            <ThemedText type="smallBold" style={loop ? { color: theme.tint } : undefined}>
              {t('surah.loop')}
            </ThemedText>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={verses}
          keyExtractor={(v) => String(v.v)}
          renderItem={renderVerse}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
        />

        <Pressable style={[styles.learnButton, { backgroundColor: theme.tint }]} onPress={startLearning}>
          <ThemedText type="default" style={styles.learnText}>
            {hasNextSegment ? t('surah.learn') : t('surah.completed')}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  headerCenter: { flex: 1 },
  headerArabic: { fontSize: 24, lineHeight: 36 },
  controls: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.two },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: { gap: Spacing.two, paddingBottom: Spacing.three },
  verseCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ayahBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arabic: { textAlign: 'right', writingDirection: 'rtl' },
  italic: { fontStyle: 'italic' },
  learnButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  learnText: { color: '#ffffff', fontWeight: '700' },
});
