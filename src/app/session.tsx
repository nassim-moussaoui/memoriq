import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlowProgress } from '@/components/onboarding/primitives';
import { MaskedArabicVerse, PhoneticLine, splitWords } from '@/components/recall-verse';
import { ListenPanel } from '@/components/session/listen-panel';
import { RatingGrid } from '@/components/session/rating-grid';
import { SessionSummary } from '@/components/session/session-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DEFAULT_REMINDER_TIMES,
  refreshReminder,
  requestReminderPermission,
  scheduleDailyReminder,
  syncAppBadge,
} from '@/lib/notifications';
import { describeNextDue, nextDueKey } from '@/lib/next-due';
import { getChapter, getVerses } from '@/lib/quran';
import { countDue, getItem, getNextDueAt, logReview, saveItem } from '@/lib/srs/db';
import { buildReviewAheadPlan, buildSessionPlan, type SessionItem } from '@/lib/srs/queue';
import { newCard, previewIntervals, rate, Rating, type Grade } from '@/lib/srs/scheduler';
import { useAppStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { useAyahAudio, type PlayingAyah } from '@/lib/use-ayah-audio';
import { useTheme } from '@/hooks/use-theme';

/**
 * The learning loop. A new verse goes listen → recite → evaluate; a review
 * goes straight to recite → evaluate. "Forgot" retries the verse at the end
 * of the session (in-session relearning).
 */
type Phase = 'listen' | 'recall' | 'rate';
type Result = { kind: SessionItem['kind']; firstGrade: Grade };

const itemKey = (item: SessionItem) => `${item.surah}:${item.ayah}`;

function StepTrack({ steps, current }: { steps: string[]; current: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepTrack}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const color = active ? theme.tint : done ? theme.text : theme.textSecondary;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: active || done ? theme.tint : 'transparent',
                  borderColor: active || done ? theme.tint : theme.backgroundSelected,
                },
              ]}>
              {done ? (
                <Ionicons name="checkmark" size={10} color="#ffffff" />
              ) : (
                <ThemedText style={[styles.stepNum, { color: active ? '#ffffff' : theme.textSecondary }]}>
                  {i + 1}
                </ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepLabel, { color, fontWeight: active ? 700 : 500 }]}>
              {label}
            </ThemedText>
            {i < steps.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: done ? theme.tint : theme.backgroundSelected }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function SessionScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const activeSurah = useAppStore((s) => s.activeSurah);
  const arabicFontScale = useAppStore((s) => s.arabicFontScale);
  const showTranslation = useAppStore((s) => s.showTranslation);
  const registerSessionDone = useAppStore((s) => s.registerSessionDone);
  const streak = useAppStore((s) => s.streak);
  const minutesPerDay = useAppStore((s) => s.minutesPerDay);
  const remindersEnabled = useAppStore((s) => s.remindersEnabled);
  const setRemindersEnabled = useAppStore((s) => s.setRemindersEnabled);
  const setReminderTime = useAppStore((s) => s.setReminderTime);
  const reviewMoment = useAppStore((s) => s.reviewMoment);

  // "ahead" mode is the voluntary extra session offered when nothing is due.
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  // The queue is frozen at mount; "Again" re-appends the item so it is
  // retried before the session ends.
  const initialQueue = useMemo(() => {
    const plan =
      mode === 'ahead' ? buildReviewAheadPlan() : buildSessionPlan(activeSurah, minutesPerDay);
    return [...plan.newItems, ...plan.reviewItems];
  }, [activeSurah, minutesPerDay, mode]);

  const [queue, setQueue] = useState<SessionItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    initialQueue[0]?.kind === 'new' ? 'listen' : 'recall',
  );
  const [revealedWords, setRevealedWords] = useState<ReadonlySet<number>>(new Set());
  const [listens, setListens] = useState(0);
  const [loop, setLoop] = useState(true);
  const loopRef = useRef(true);
  const [results, setResults] = useState<Record<string, Result>>({});

  const item = queue[index];
  const finished = index >= queue.length;
  // A retry of a verse forgotten earlier in this session.
  const isRetry = !!item && itemKey(item) in results;

  const onAyahFinishedRef = useRef<(played: PlayingAyah) => void>(() => {});
  const { play, stop, playing } = useAyahAudio((played) => onAyahFinishedRef.current(played));

  useEffect(() => {
    onAyahFinishedRef.current = (played) => {
      if (phase !== 'listen' || !item || played.ayah !== item.ayah || played.surah !== item.surah) {
        return;
      }
      setListens((n) => n + 1);
      if (loopRef.current) play(played.surah, played.ayah);
    };
  });

  // Each new verse starts playing on its own when its listen stage opens.
  const autoplay = useEffectEvent(() => {
    if (phase === 'listen' && item) play(item.surah, item.ayah);
  });
  useEffect(() => {
    if (phase !== 'listen') return;
    const timer = setTimeout(autoplay, 450);
    return () => clearTimeout(timer);
  }, [index, phase]);

  // Snapshot of what is left once the session ends: read once, after
  // registerSessionDone has already run.
  const doneStats = useMemo(() => {
    if (!finished) return null;
    const nextAt = getNextDueAt();
    return {
      remainingDue: countDue(),
      nextDue: nextAt ? describeNextDue(nextAt, i18n.language) : null,
    };
  }, [finished, i18n.language]);

  // Interval preview for the rating cards. Memoized: FSRS fuzz would make
  // the values jitter on every re-render otherwise.
  const previews = useMemo(() => {
    if (!item || phase !== 'rate') return null;
    const card = getItem(item.surah, item.ayah)?.card ?? newCard();
    return previewIntervals(card);
  }, [item, phase]);

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

  const close = () => {
    stop();
    router.back();
  };

  if (finished || !item) {
    const all = Object.values(results);
    const firstTry = all.filter((r) => r.firstGrade !== Rating.Again).length;
    const nextDue = doneStats?.nextDue;
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <SessionSummary
            empty={all.length === 0}
            newCount={all.filter((r) => r.kind === 'new').length}
            reviewCount={all.filter((r) => r.kind === 'review').length}
            successRate={all.length > 0 ? firstTry / all.length : null}
            streak={streak}
            nextDueText={
              nextDue ? t(nextDueKey(nextDue.kind), { time: nextDue.value, date: nextDue.value }) : null
            }
            remainingDue={doneStats?.remainingDue ?? 0}
            reminderOffer={remindersEnabled ? null : DEFAULT_REMINDER_TIMES[reviewMoment]}
            onContinue={() => router.replace('/session')}
            onEnableReminders={() => void enableReminders()}
            onClose={() => router.back()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const chapter = getChapter(item.surah);
  const verse = getVerses(item.surah)[item.ayah - 1];
  const isPlaying = playing?.surah === item.surah && playing?.ayah === item.ayah;
  const wordCount = splitWords(verse.tr).length;
  const isNew = item.kind === 'new' && !isRetry;
  const fullyShown = phase !== 'recall';

  const advance = (nextQueue: SessionItem[], nextResults: Record<string, Result>) => {
    stop();
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setRevealedWords(new Set());
    setListens(0);
    const next = nextQueue[nextIndex];
    if (next) {
      const retry = itemKey(next) in nextResults;
      setPhase(next.kind === 'new' && !retry ? 'listen' : 'recall');
    } else {
      registerSessionDone();
    }
  };

  const onRate = (grade: Grade) => {
    const existing = getItem(item.surah, item.ayah);
    const card = existing?.card ?? newCard();
    saveItem(item.surah, item.ayah, rate(card, grade));
    logReview(item.surah, item.ayah, grade);

    const key = itemKey(item);
    const nextResults =
      key in results ? results : { ...results, [key]: { kind: item.kind, firstGrade: grade } };
    setResults(nextResults);

    let nextQueue = queue;
    if (grade === Rating.Again) {
      nextQueue = [...queue, item];
      setQueue(nextQueue);
    }
    advance(nextQueue, nextResults);
  };

  const revealWord = (wordIndex: number) => {
    const next = new Set(revealedWords);
    next.add(wordIndex);
    setRevealedWords(next);
    // Every word checked: the verse is complete, time to evaluate.
    if (next.size >= wordCount) setPhase('rate');
  };

  const toggleLoop = () => {
    loopRef.current = !loopRef.current;
    setLoop(loopRef.current);
  };

  const steps = isNew
    ? [t('session.stepListen'), t('session.stepRecite'), t('session.stepRate')]
    : [t('session.stepRecite'), t('session.stepRate')];
  const stepIndex = isNew
    ? phase === 'listen'
      ? 0
      : phase === 'recall'
        ? 1
        : 2
    : phase === 'recall'
      ? 0
      : 1;

  const kindColor = isRetry ? theme.danger : item.kind === 'new' ? theme.tint : theme.info;
  const kindLabel = isRetry
    ? t('session.retryBadge')
    : item.kind === 'new'
      ? t('session.newBadge')
      : t('session.reviewBadge');

  const instruction =
    phase === 'listen'
      ? t('session.listenHint')
      : phase === 'recall'
        ? t('session.recallHint')
        : t('session.rateHint');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
          <FlowProgress progress={index / queue.length} />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.counter}>
            {`${Math.min(index + 1, queue.length)}/${queue.length}`}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View key={`${index}`} entering={FadeInRight.duration(320)} style={styles.itemBlock}>
            <View style={styles.contextRow}>
              <View style={[styles.kindChip, { backgroundColor: kindColor + '22' }]}>
                <View style={[styles.kindDot, { backgroundColor: kindColor }]} />
                <ThemedText type="smallBold" style={{ color: kindColor }}>
                  {kindLabel}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                {t('session.verseRef', { surah: chapter.nameSimple, ayah: item.ayah })}
              </ThemedText>
              <ThemedText style={[styles.surahArabic, { color: theme.textSecondary }]}>
                {chapter.nameArabic}
              </ThemedText>
            </View>

            <StepTrack steps={steps} current={stepIndex} />

            <View
              style={[
                styles.verseCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: phase === 'rate' ? theme.tint + '55' : 'transparent',
                },
              ]}>
              {fullyShown && phase === 'rate' ? (
                <Pressable
                  onPress={() => (isPlaying ? stop() : play(item.surah, item.ayah))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? t('a11y.pause') : t('a11y.playVerse')}
                  style={[styles.cardAudio, { backgroundColor: theme.background }]}>
                  <Ionicons name={isPlaying ? 'pause' : 'volume-medium-outline'} size={16} color={theme.tint} />
                </Pressable>
              ) : null}
              <MaskedArabicVerse
                text={verse.ar}
                revealed={fullyShown ? 'all' : revealedWords}
                onReveal={phase === 'recall' ? revealWord : undefined}
                fontScale={arabicFontScale * 1.1}
              />
              <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
              <PhoneticLine
                text={verse.tr}
                revealed={fullyShown ? 'all' : revealedWords}
                onReveal={phase === 'recall' ? revealWord : undefined}
              />
              {fullyShown && showTranslation ? (
                <Animated.View entering={FadeIn.duration(400)}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.translation}>
                    {i18n.language === 'fr' ? verse.fr : verse.en}
                  </ThemedText>
                </Animated.View>
              ) : null}
            </View>

            <View style={styles.instruction}>
              <Ionicons
                name={phase === 'listen' ? 'headset-outline' : phase === 'recall' ? 'mic-outline' : 'help-buoy-outline'}
                size={16}
                color={theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {instruction}
              </ThemedText>
            </View>

            {phase === 'recall' && revealedWords.size > 0 ? (
              <ThemedText style={[styles.peekCount, { color: theme.textSecondary }]}>
                {t('session.wordsChecked', { count: revealedWords.size, total: wordCount })}
              </ThemedText>
            ) : null}

            {phase === 'listen' ? (
              <ListenPanel
                playing={isPlaying}
                listens={listens}
                loop={loop}
                onPlay={() => play(item.surah, item.ayah)}
                onStop={stop}
                onToggleLoop={toggleLoop}
              />
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {phase === 'listen' ? (
            <PrimaryButton
              label={t('session.readyToRecite')}
              icon="mic-outline"
              onPress={() => {
                stop();
                setPhase('recall');
              }}
            />
          ) : phase === 'recall' ? (
            <PrimaryButton
              label={t('session.check')}
              icon="eye-outline"
              onPress={() => setPhase('rate')}
            />
          ) : (
            <RatingGrid key={`${index}`} intervals={previews} onRate={onRate} />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { minWidth: 40, textAlign: 'right' },
  content: { paddingVertical: Spacing.two, flexGrow: 1 },
  itemBlock: { gap: Spacing.three },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindDot: { width: 7, height: 7, borderRadius: 4 },
  surahArabic: { fontSize: 20, lineHeight: 34, writingDirection: 'rtl' },
  stepTrack: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
  stepLabel: { fontSize: 13, lineHeight: 17 },
  stepLine: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 4 },
  verseCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.three,
  },
  cardAudio: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  divider: { height: 1, marginHorizontal: Spacing.five },
  translation: { textAlign: 'center', fontWeight: 400, lineHeight: 20 },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  peekCount: { fontSize: 12, lineHeight: 16, paddingHorizontal: Spacing.one },
  footer: { paddingTop: Spacing.two, paddingBottom: Spacing.three },
});
