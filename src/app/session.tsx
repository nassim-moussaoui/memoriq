import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaskedVerse, type MaskLevel } from '@/components/masked-verse';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getChapter, getVerses } from '@/lib/quran';
import { getItem, logReview, saveItem } from '@/lib/srs/db';
import { buildSessionPlan, type SessionItem } from '@/lib/srs/queue';
import { newCard, rate, Rating, type Grade } from '@/lib/srs/scheduler';
import { useAppStore } from '@/lib/store';
import { useAyahAudio, type PlayingAyah } from '@/lib/use-ayah-audio';
import { useTheme } from '@/hooks/use-theme';

type Phase = 'listen' | 'recall';

export default function SessionScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeSurah = useAppStore((s) => s.activeSurah);
  const arabicFontScale = useAppStore((s) => s.arabicFontScale);
  const showTranslation = useAppStore((s) => s.showTranslation);
  const registerSessionDone = useAppStore((s) => s.registerSessionDone);

  // The queue is frozen at mount; "Again" ratings re-append the item so it is
  // retried before the session ends (in-session relearning).
  const initialQueue = useMemo(() => {
    const plan = buildSessionPlan(activeSurah);
    return [...plan.newItems, ...plan.reviewItems];
  }, [activeSurah]);

  const [queue, setQueue] = useState<SessionItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    initialQueue[0]?.kind === 'new' ? 'listen' : 'recall'
  );
  const [maskLevel, setMaskLevel] = useState<MaskLevel>(2);
  const [revealed, setRevealed] = useState(false);
  const [loop, setLoop] = useState(true);
  const loopRef = useRef(true);
  const [doneCounts, setDoneCounts] = useState({ new: 0, reviews: 0 });

  const onAyahFinishedRef = useRef<(played: PlayingAyah) => void>(() => {});
  const { play, stop, playing } = useAyahAudio((played) => onAyahFinishedRef.current(played));

  useEffect(() => {
    onAyahFinishedRef.current = (played) => {
      if (loopRef.current && phase === 'listen') {
        play(played.surah, played.ayah);
      }
    };
  });

  const item = queue[index];
  const finished = index >= queue.length;

  const advance = (nextQueue: SessionItem[]) => {
    stop();
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setRevealed(false);
    setMaskLevel(2);
    const next = nextQueue[nextIndex];
    if (next) {
      setPhase(next.kind === 'new' ? 'listen' : 'recall');
    } else {
      registerSessionDone();
    }
  };

  const onRate = (rating: Grade) => {
    const existing = getItem(item.surah, item.ayah);
    const card = existing?.card ?? newCard();
    const updated = rate(card, rating);
    saveItem(item.surah, item.ayah, updated);
    logReview(item.surah, item.ayah, rating);

    setDoneCounts((c) =>
      item.kind === 'new' ? { ...c, new: c.new + 1 } : { ...c, reviews: c.reviews + 1 }
    );

    let nextQueue = queue;
    if (rating === Rating.Again) {
      nextQueue = [...queue, { ...item, kind: 'review' as const }];
      setQueue(nextQueue);
    }
    advance(nextQueue);
  };

  const toggleLoop = () => {
    loopRef.current = !loopRef.current;
    setLoop(loopRef.current);
  };

  if (finished || !item) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.doneContainer]}>
          <Ionicons name="checkmark-circle" size={64} color={theme.tint} />
          <ThemedText type="subtitle" style={styles.center}>
            {t('session.done')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('session.doneSummary', {
              new: doneCounts.new,
              reviews: doneCounts.reviews,
            })}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.scienceCard}>
            <Ionicons name="school-outline" size={18} color={theme.tint} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              {t('session.doneScience')}
            </ThemedText>
          </ThemedView>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            onPress={() => router.back()}>
            <ThemedText type="default" style={styles.primaryButtonText}>
              {t('session.backHome')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const chapter = getChapter(item.surah);
  const verse = getVerses(item.surah)[item.ayah - 1];
  const isPlaying = playing?.surah === item.surah && playing?.ayah === item.ayah;
  const progress = index / queue.length;

  const title =
    item.kind === 'new'
      ? phase === 'listen'
        ? t('session.listenTitle')
        : t('session.recallTitle')
      : t('session.reviewTitle');
  const hint =
    item.kind === 'new'
      ? phase === 'listen'
        ? t('session.listenHint')
        : t('session.recallHint')
      : t('session.reviewHint');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable onPress={() => { stop(); router.back(); }} hitSlop={8}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.tint, width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {index + 1}/{queue.length}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.kind === 'new' ? theme.tintSoft : theme.backgroundElement },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: item.kind === 'new' ? theme.tint : theme.textSecondary }}>
                {item.kind === 'new' ? t('session.newBadge') : t('session.reviewBadge')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {chapter.nameSimple} · {item.ayah}
            </ThemedText>
          </View>

          <ThemedText type="default">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.verseCard}>
            {phase === 'listen' || revealed ? (
              <MaskedVerse text={verse.ar} level={0} fontScale={arabicFontScale} />
            ) : (
              <MaskedVerse text={verse.ar} level={maskLevel} fontScale={arabicFontScale} />
            )}
            {(phase === 'listen' || revealed) && showTranslation && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {i18n.language === 'fr' ? verse.fr : verse.en}
              </ThemedText>
            )}
          </ThemedView>

          {(phase === 'listen' || revealed) && (
            <View style={styles.audioRow}>
              <Pressable
                style={[styles.controlButton, { backgroundColor: theme.backgroundElement }]}
                onPress={() => (isPlaying ? stop() : play(item.surah, item.ayah))}>
                <Ionicons name={isPlaying ? 'stop' : 'play'} size={16} color={theme.tint} />
                <ThemedText type="smallBold">{t('session.playAyah')}</ThemedText>
              </Pressable>
              {phase === 'listen' && (
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
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {phase === 'listen' ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
              onPress={() => {
                stop();
                setPhase('recall');
                setMaskLevel(2);
              }}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                {t('session.next')}
              </ThemedText>
            </Pressable>
          ) : !revealed ? (
            <View style={styles.recallActions}>
              {maskLevel === 2 && (
                <Pressable
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
                  onPress={() => setMaskLevel(1)}>
                  <Ionicons name="bulb-outline" size={16} color={theme.warning} />
                  <ThemedText type="smallBold">{t('session.maskLess')}</ThemedText>
                </Pressable>
              )}
              <Pressable
                style={[styles.primaryButton, styles.grow, { backgroundColor: theme.tint }]}
                onPress={() => setRevealed(true)}>
                <ThemedText type="default" style={styles.primaryButtonText}>
                  {t('session.reveal')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.ratingRow}>
              <RatingButton color={theme.danger} label={t('session.again')} onPress={() => onRate(Rating.Again)} />
              <RatingButton color={theme.warning} label={t('session.hard')} onPress={() => onRate(Rating.Hard)} />
              <RatingButton color={theme.tint} label={t('session.good')} onPress={() => onRate(Rating.Good)} />
              <RatingButton color={theme.info} label={t('session.easy')} onPress={() => onRate(Rating.Easy)} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function RatingButton({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={[styles.ratingButton, { backgroundColor: theme.backgroundElement, borderColor: color }]}
      onPress={onPress}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  content: { gap: Spacing.two, paddingVertical: Spacing.two },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  verseCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  audioRow: { flexDirection: 'row', gap: Spacing.two },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  footer: { paddingVertical: Spacing.three, gap: Spacing.two },
  recallActions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'stretch' },
  grow: { flex: 1 },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  ratingRow: { flexDirection: 'row', gap: Spacing.two },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  doneContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  center: { textAlign: 'center' },
  scienceCard: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
});
