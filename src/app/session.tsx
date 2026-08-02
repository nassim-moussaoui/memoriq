import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlurredArabicVerse, PhoneticLine, splitWords } from '@/components/recall-verse';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DEFAULT_REMINDER_TIMES,
  refreshReminder,
  requestReminderPermission,
  scheduleDailyReminder,
  syncAppBadge,
} from '@/lib/notifications';
import { getChapter, getVerses } from '@/lib/quran';
import { getItem, logReview, saveItem } from '@/lib/srs/db';
import { buildReviewAheadPlan, buildSessionPlan, type SessionItem } from '@/lib/srs/queue';
import { newCard, previewIntervals, rate, Rating, type Grade } from '@/lib/srs/scheduler';
import { useAppStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
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
  const minutesPerDay = useAppStore((s) => s.minutesPerDay);
  const remindersEnabled = useAppStore((s) => s.remindersEnabled);
  const setRemindersEnabled = useAppStore((s) => s.setRemindersEnabled);
  const setReminderTime = useAppStore((s) => s.setReminderTime);
  const reviewMoment = useAppStore((s) => s.reviewMoment);

  // "ahead" mode is the voluntary extra session offered when nothing is due.
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  // The queue is frozen at mount; "Again" ratings re-append the item so it is
  // retried before the session ends (in-session relearning).
  const initialQueue = useMemo(() => {
    const plan =
      mode === 'ahead' ? buildReviewAheadPlan() : buildSessionPlan(activeSurah, minutesPerDay);
    return [...plan.newItems, ...plan.reviewItems];
  }, [activeSurah, minutesPerDay, mode]);

  const [queue, setQueue] = useState<SessionItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    initialQueue[0]?.kind === 'new' ? 'listen' : 'recall'
  );
  const [revealedWords, setRevealedWords] = useState<ReadonlySet<number>>(new Set());
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

  // Interval preview for the rating buttons. Memoized: FSRS fuzz would make
  // the values jitter on every re-render otherwise.
  const previews = useMemo(() => {
    if (!item || !revealed) return null;
    const card = getItem(item.surah, item.ayah)?.card ?? newCard();
    return previewIntervals(card);
  }, [item, revealed]);

  useEffect(() => {
    if (finished) {
      syncNow().catch(() => {});
      // Tomorrow's reminder copy depends on what this session just changed.
      refreshReminder().catch(() => {});
      syncAppBadge().catch(() => {});
    }
  }, [finished]);

  const enableReminders = async () => {
    const granted = await requestReminderPermission();
    if (!granted) {
      Alert.alert(t('notif.permissionTitle'), t('notif.permissionBody'));
      return;
    }
    const time = DEFAULT_REMINDER_TIMES[reviewMoment];
    setReminderTime(time);
    setRemindersEnabled(true);
    await scheduleDailyReminder(time);
  };

  const advance = (nextQueue: SessionItem[]) => {
    stop();
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setRevealed(false);
    setRevealedWords(new Set());
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

  const formatInterval = (mins: number) => {
    if (mins < 60) return t('session.intMinutes', { count: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t('session.intHours', { count: hours });
    const days = Math.round(hours / 24);
    if (days < 30) return t('session.intDays', { count: days });
    return t('session.intMonths', { count: Math.round(days / 30) });
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
          {!remindersEnabled && (
            <Pressable
              style={[styles.reminderCard, { backgroundColor: theme.tintSoft }]}
              onPress={() => void enableReminders()}>
              <Ionicons name="notifications-outline" size={18} color={theme.tint} />
              <ThemedText type="smallBold" style={{ flex: 1, color: theme.tint }}>
                {t('notif.optIn', { time: DEFAULT_REMINDER_TIMES[reviewMoment] })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={theme.tint} />
            </Pressable>
          )}
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

  const revealWord = (wordIndex: number) => {
    void Haptics.selectionAsync();
    const next = new Set(revealedWords);
    next.add(wordIndex);
    setRevealedWords(next);
    // Every word checked: show the full verse and move on to self-rating.
    if (next.size >= splitWords(verse.tr).length) setRevealed(true);
  };

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
          <Pressable
            onPress={() => { stop(); router.back(); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}>
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
            <BlurredArabicVerse
              text={verse.ar}
              revealed={phase === 'listen' || revealed ? 'all' : revealedWords}
              onReveal={phase === 'recall' && !revealed ? revealWord : undefined}
              fontScale={arabicFontScale}
            />
            <PhoneticLine
              text={verse.tr}
              revealed={phase === 'listen' || revealed ? 'all' : revealedWords}
              onReveal={phase === 'recall' && !revealed ? revealWord : undefined}
            />
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
              }}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                {t('session.next')}
              </ThemedText>
            </Pressable>
          ) : !revealed ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
              onPress={() => setRevealed(true)}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                {t('session.reveal')}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.ratingRow}>
              {(
                [
                  [Rating.Again, t('session.again'), theme.danger],
                  [Rating.Hard, t('session.hard'), theme.warning],
                  [Rating.Good, t('session.good'), theme.tint],
                  [Rating.Easy, t('session.easy'), theme.info],
                ] as const
              ).map(([grade, label, color]) => (
                <RatingButton
                  key={label}
                  color={color}
                  label={label}
                  interval={previews ? formatInterval(previews[grade]) : undefined}
                  onPress={() => onRate(grade)}
                />
              ))}
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
  interval,
  onPress,
}: {
  color: string;
  label: string;
  interval?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.ratingButton,
        { backgroundColor: color + '1F', transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
      {interval ? (
        <ThemedText style={[styles.ratingInterval, { color }]}>{interval}</ThemedText>
      ) : null}
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
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  ratingRow: { flexDirection: 'row', gap: Spacing.two },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  ratingInterval: { fontSize: 11, lineHeight: 14, opacity: 0.75 },
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
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignSelf: 'stretch',
  },
});
