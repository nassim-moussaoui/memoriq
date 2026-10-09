import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedCounter, Card, enterUp, StepHeader } from '@/components/onboarding/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getChapter } from '@/lib/quran';
import { budgetFor } from '@/lib/srs/queue';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BUILD_MS = 2600;
const STEPS = 3;
const RING = 132;
const STROKE = 8;

/** Progress ring with a live percentage in its center. */
function BuildRing({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const percent = useSharedValue(0);
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const duration = reduceMotion ? 600 : BUILD_MS;
    const easing = Easing.inOut(Easing.cubic);
    progress.value = withTiming(1, { duration, easing });
    percent.value = withTiming(100, { duration, easing });
    const timer = setTimeout(done, duration + 150);
    return () => clearTimeout(timer);
  }, [percent, progress, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={styles.ringSvg}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={theme.backgroundElement}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={theme.tint}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={[circumference, circumference]}
          fill="none"
          animatedProps={ringProps}
        />
      </Svg>
      <AnimatedCounter value={percent} suffix=" %" style={styles.ringText} />
    </View>
  );
}

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkSlot}>
        {done ? (
          <Animated.View entering={ZoomIn.springify().damping(11)}>
            <Ionicons name="checkmark-circle" size={22} color={theme.tint} />
          </Animated.View>
        ) : (
          <View style={[styles.checkEmpty, { borderColor: theme.backgroundSelected }]} />
        )}
      </View>
      <ThemedText style={[styles.checkLabel, !done && { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function Stat({ value, label, index }: { value: string; label: string; index: number }) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(260 + index * 90).springify().damping(18)}
      style={[styles.stat, { backgroundColor: theme.background }]}>
      <ThemedText style={[styles.statValue, { color: theme.tint }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </Animated.View>
  );
}

/**
 * Last step: a short "building your plan" moment (ring + checklist ticking),
 * then the personal summary: first surah, daily dose, reminder opt-in.
 */
export function PlanBuilder({
  surahId,
  continuing,
  minutesPerDay,
  reminderTime,
  reminderOn,
  setReminderOn,
  onReady,
}: {
  surahId: number;
  /** True when revisiting the plan: the surah shown is the one in progress. */
  continuing: boolean;
  minutesPerDay: 5 | 10 | 20;
  reminderTime: string;
  reminderOn: boolean;
  setReminderOn: (on: boolean) => void;
  onReady: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [ticks, setTicks] = useState(0);
  const [built, setBuilt] = useState(false);
  const chapter = getChapter(surahId);
  const budget = budgetFor(minutesPerDay);

  useEffect(() => {
    const timers = Array.from({ length: STEPS }, (_, i) =>
      setTimeout(() => {
        setTicks(i + 1);
        void Haptics.selectionAsync();
      }, ((i + 1) * BUILD_MS) / (STEPS + 0.4)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const finishBuild = () => {
    setBuilt(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReady();
  };

  if (!built) {
    return (
      <View style={styles.building}>
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <BuildRing onDone={finishBuild} />
        </Animated.View>
        <Animated.View entering={enterUp(1)}>
          <ThemedText style={styles.buildTitle}>{t('onboarding.buildTitle')}</ThemedText>
        </Animated.View>
        <Animated.View entering={enterUp(2)} style={styles.checklist}>
          {[1, 2, 3].map((n) => (
            <ChecklistRow key={n} label={t(`onboarding.buildStep${n}`)} done={ticks >= n} />
          ))}
        </Animated.View>
      </View>
    );
  }

  const surahName = i18n.language.startsWith('fr') ? chapter.nameFr : chapter.nameEn;

  return (
    <View style={styles.ready}>
      <StepHeader
        eyebrow={t('onboarding.readyEyebrow')}
        title={t('onboarding.readyTitle')}
        body={t('onboarding.readyBody')}
      />
      <Animated.View entering={enterUp(3)}>
        <Card style={styles.summary}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.center}>
            {continuing ? t('onboarding.currentSurah') : t('onboarding.firstSurah')}
          </ThemedText>
          <Animated.Text
            entering={FadeIn.delay(350).duration(800)}
            style={[styles.surahArabic, { color: theme.text }]}>
            {chapter.nameArabic}
          </Animated.Text>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {`${chapter.nameSimple} · ${surahName} · ${t('onboarding.versesCount', { count: chapter.versesCount })}`}
          </ThemedText>
          <View style={styles.stats}>
            <Stat index={0} value={`${minutesPerDay}`} label={t('onboarding.statMinutes')} />
            <Stat index={1} value={`${budget.maxNew}`} label={t('onboarding.statNew')} />
            <Stat index={2} value={`${budget.maxReviews}`} label={t('onboarding.statReviews')} />
          </View>
        </Card>
      </Animated.View>
      <Animated.View entering={enterUp(4)}>
        <Card style={styles.reminder}>
          <View style={[styles.reminderIcon, { backgroundColor: theme.tintSoft }]}>
            <Ionicons name="notifications-outline" size={20} color={theme.tint} />
          </View>
          <View style={styles.reminderText}>
            <ThemedText style={styles.reminderTitle}>{t('onboarding.reminderTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.reminderDesc}>
              {t('onboarding.reminderDesc', { time: reminderTime })}
            </ThemedText>
          </View>
          <Switch
            value={reminderOn}
            onValueChange={(on) => {
              void Haptics.selectionAsync();
              setReminderOn(on);
            }}
            trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
          />
        </Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  building: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringText: { fontSize: 28, lineHeight: 34, fontWeight: 800, textAlign: 'center' },
  buildTitle: { fontSize: 22, lineHeight: 28, fontWeight: 800, textAlign: 'center' },
  checklist: { gap: Spacing.three, alignSelf: 'stretch', paddingHorizontal: Spacing.four },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkSlot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  checkEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  checkLabel: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: 600 },
  ready: { gap: Spacing.four },
  center: { textAlign: 'center' },
  summary: { gap: Spacing.two, alignItems: 'stretch' },
  surahArabic: {
    fontSize: 44,
    lineHeight: 80,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  stats: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    gap: 2,
  },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
  statLabel: { fontSize: 11.5, lineHeight: 15, textAlign: 'center', fontWeight: 500 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { fontSize: 15, lineHeight: 20, fontWeight: 700 },
  reminderDesc: { fontWeight: 400, lineHeight: 18 },
});
