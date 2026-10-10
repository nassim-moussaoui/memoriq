import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChartLegend, ForgettingCurveChart, SpacedRepetitionChart } from '@/components/onboarding/charts';
import { HadithCarousel } from '@/components/onboarding/hadith-carousel';
import { GeometricStar, RevealedVerse } from '@/components/onboarding/hero';
import { PlanBuilder } from '@/components/onboarding/plan-builder';
import {
  AmbientBackground,
  enterUp,
  OptionCard,
  StepHeader,
  type IconName,
} from '@/components/onboarding/primitives';
import { RecallDemo } from '@/components/onboarding/recall-demo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FlowProgress } from '@/components/ui/flow-progress';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelReminders,
  DEFAULT_REMINDER_TIMES,
  requestReminderPermission,
  scheduleDailyReminder,
} from '@/lib/notifications';
import { getVerses } from '@/lib/quran';
import { budgetFor } from '@/lib/srs/queue';
import { startingSurahForGoal, useAppStore, type Goal, type ReviewMoment } from '@/lib/store';

const STEPS = [
  'welcome',
  'forgetting',
  'spacing',
  'recall',
  'sunna',
  'goal',
  'time',
  'moment',
  'plan',
] as const;
type StepId = (typeof STEPS)[number];

const GOAL_STEP = STEPS.indexOf('goal');
const PLAN_STEP = STEPS.indexOf('plan');

/** Surah 54, verse 17: "And We have certainly made the Qur'an easy for remembrance". */
const WELCOME_VERSE = { surah: 54, index: 16 };

function StepScroll({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, centered && styles.centered]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const slideWidth = Math.min(width, MaxContentWidth);
  const chartWidth = Math.min(slideWidth - Spacing.four * 2, 380);

  const alreadyCompleted = useAppStore((s) => s.onboardingCompleted);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const storedGoal = useAppStore((s) => s.goal);
  const storedMinutes = useAppStore((s) => s.minutesPerDay);
  const storedMoment = useAppStore((s) => s.reviewMoment);
  const activeSurah = useAppStore((s) => s.activeSurah);
  const remindersEnabled = useAppStore((s) => s.remindersEnabled);
  const storedReminderTime = useAppStore((s) => s.reminderTime);
  const setRemindersEnabled = useAppStore((s) => s.setRemindersEnabled);
  const setReminderTime = useAppStore((s) => s.setReminderTime);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [planReady, setPlanReady] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // When revisiting from the Profile, start from the saved plan so walking
  // through the steps never silently resets it.
  const [goal, setGoal] = useState<Goal>(alreadyCompleted ? storedGoal : 'juzamma');
  const [minutesPerDay, setMinutesPerDay] = useState<5 | 10 | 20>(
    alreadyCompleted ? storedMinutes : 10,
  );
  const [reviewMoment, setReviewMoment] = useState<ReviewMoment>(
    alreadyCompleted ? storedMoment : 'evening',
  );
  const [reminderOn, setReminderOn] = useState(alreadyCompleted ? remindersEnabled : true);

  // Keep a custom reminder time unless the moment itself changed.
  const reminderTime =
    alreadyCompleted && reviewMoment === storedMoment && storedReminderTime
      ? storedReminderTime
      : DEFAULT_REMINDER_TIMES[reviewMoment];

  const goTo = (target: number) => {
    const next = Math.min(Math.max(target, 0), STEPS.length - 1);
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    if (next === PLAN_STEP) setPlanReady(false);
    setStep(next);
  };

  // Android back button walks the flow backwards instead of leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setDirection(-1);
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    completeOnboarding({ minutesPerDay, goal, reviewMoment });
    try {
      if (reminderOn) {
        const granted = await requestReminderPermission();
        setRemindersEnabled(granted);
        if (granted) {
          setReminderTime(reminderTime);
          await scheduleDailyReminder(reminderTime);
        }
      } else if (remindersEnabled) {
        setRemindersEnabled(false);
        await cancelReminders();
      }
    } catch {
      // Reminders are a convenience: never block the start on them.
    }
    if (alreadyCompleted) {
      router.back();
      return;
    }
    router.replace('/');
    // First run only: offer Premium once, on top of Today, always closable.
    if (!useAppStore.getState().isPremium) {
      router.push({ pathname: '/paywall', params: { from: 'onboarding' } });
    }
  };

  const id: StepId = STEPS[step];
  const isScience = step < GOAL_STEP;

  const renderStep = () => {
    switch (id) {
      case 'welcome': {
        const verse = getVerses(WELCOME_VERSE.surah)[WELCOME_VERSE.index];
        const starSize = Math.min(slideWidth * 0.5, 210);
        return (
          <StepScroll centered>
            <View style={styles.welcome}>
              <Animated.View entering={FadeIn.duration(400)}>
                <GeometricStar size={starSize} />
              </Animated.View>
              <View style={styles.brandBlock}>
                <Animated.View entering={enterUp(0, 700)}>
                  <ThemedText style={styles.brand}>Memoriq</ThemedText>
                </Animated.View>
                <Animated.View entering={enterUp(1, 700)}>
                  <ThemedText themeColor="textSecondary" style={styles.tagline}>
                    {t('onboarding.welcomeTagline')}
                  </ThemedText>
                </Animated.View>
              </View>
              <RevealedVerse
                arabic={verse.ar}
                translation={t('onboarding.welcomeVerse')}
                source={t('onboarding.welcomeVerseSource')}
                delay={1300}
              />
            </View>
          </StepScroll>
        );
      }
      case 'forgetting':
        return (
          <StepScroll centered>
            <StepHeader
              eyebrow={t('onboarding.scienceEyebrow', { n: 1 })}
              title={t('onboarding.forgetTitle')}
            />
            <Animated.View entering={enterUp(2)} style={styles.chart}>
              <ForgettingCurveChart
                width={chartWidth}
                xLabel={t('onboarding.axisDays')}
                dayPrefix={t('onboarding.dayPrefix')}
                memoryLabel={t('onboarding.memoryLeft')}
                halfLabel={t('onboarding.halfLabel')}
              />
            </Animated.View>
            <Animated.View entering={enterUp(3)}>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                {t('onboarding.forgetBody')}
              </ThemedText>
            </Animated.View>
          </StepScroll>
        );
      case 'spacing':
        return (
          <StepScroll centered>
            <StepHeader
              eyebrow={t('onboarding.scienceEyebrow', { n: 2 })}
              title={t('onboarding.spaceTitle')}
            />
            <Animated.View entering={enterUp(2)} style={styles.chart}>
              <SpacedRepetitionChart
                width={chartWidth}
                xLabel={t('onboarding.axisDays')}
                dayShort={t('onboarding.dayShort')}
              />
              <ChartLegend
                items={[
                  { color: theme.tint, label: t('onboarding.spaceWith') },
                  { color: theme.textSecondary, muted: true, label: t('onboarding.spaceWithout') },
                ]}
              />
            </Animated.View>
            <Animated.View entering={enterUp(3)}>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                {t('onboarding.spaceBody')}
              </ThemedText>
            </Animated.View>
          </StepScroll>
        );
      case 'recall':
        return (
          <StepScroll>
            <StepHeader
              eyebrow={t('onboarding.scienceEyebrow', { n: 3 })}
              title={t('onboarding.recallTitle')}
              body={t('onboarding.recallBody')}
            />
            <Animated.View entering={enterUp(3)}>
              <RecallDemo chartWidth={chartWidth} />
            </Animated.View>
          </StepScroll>
        );
      case 'sunna':
        return (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.sunnaContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.padded}>
              <StepHeader
                eyebrow={t('onboarding.sunnaEyebrow')}
                title={t('onboarding.sunnaTitle')}
                body={t('onboarding.sunnaBody')}
              />
            </View>
            <HadithCarousel width={slideWidth} />
          </ScrollView>
        );
      case 'goal': {
        const goals: { value: Goal; icon: IconName }[] = [
          { value: 'juzamma', icon: 'book-outline' },
          { value: 'prayer', icon: 'heart-outline' },
          { value: 'hifz', icon: 'flag-outline' },
        ];
        return (
          <StepScroll>
            <StepHeader
              eyebrow={t('onboarding.planEyebrow', { n: 1 })}
              title={t('onboarding.goalQuestion')}
              align="left"
            />
            <View style={styles.options}>
              {goals.map((g, i) => (
                <Animated.View key={g.value} entering={enterUp(2 + i)}>
                  <OptionCard
                    selected={goal === g.value}
                    icon={g.icon}
                    title={t(`onboarding.goal_${g.value}`)}
                    desc={t(`onboarding.goal_${g.value}Desc`)}
                    onPress={() => setGoal(g.value)}
                  />
                </Animated.View>
              ))}
            </View>
          </StepScroll>
        );
      }
      case 'time': {
        const times: { value: 5 | 10 | 20; icon: IconName }[] = [
          { value: 5, icon: 'leaf-outline' },
          { value: 10, icon: 'time-outline' },
          { value: 20, icon: 'flame-outline' },
        ];
        const budget = budgetFor(minutesPerDay);
        return (
          <StepScroll>
            <StepHeader
              eyebrow={t('onboarding.planEyebrow', { n: 2 })}
              title={t('onboarding.timeQuestion')}
              body={t('onboarding.timeBody')}
              align="left"
            />
            <View style={styles.options}>
              {times.map((m, i) => (
                <Animated.View key={m.value} entering={enterUp(3 + i)}>
                  <OptionCard
                    selected={minutesPerDay === m.value}
                    icon={m.icon}
                    title={t('onboarding.minutes', { count: m.value })}
                    desc={t(`onboarding.time${m.value}`)}
                    badge={m.value === 10 ? t('onboarding.recommended') : undefined}
                    onPress={() => setMinutesPerDay(m.value)}
                  />
                </Animated.View>
              ))}
            </View>
            <Animated.View
              key={minutesPerDay}
              entering={FadeIn.duration(350)}
              style={[styles.outcome, { backgroundColor: theme.tintSoft }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.tint} />
              <ThemedText type="small" style={[styles.outcomeText, { color: theme.tint }]}>
                {t('onboarding.timeOutcome', { count: budget.maxNew, reviews: budget.maxReviews })}
              </ThemedText>
            </Animated.View>
          </StepScroll>
        );
      }
      case 'moment': {
        const moments: { value: ReviewMoment; icon: IconName }[] = [
          { value: 'morning', icon: 'sunny-outline' },
          { value: 'afterPrayer', icon: 'compass-outline' },
          { value: 'evening', icon: 'moon-outline' },
        ];
        return (
          <StepScroll>
            <StepHeader
              eyebrow={t('onboarding.planEyebrow', { n: 3 })}
              title={t('onboarding.momentQuestion')}
              body={t('onboarding.momentBody')}
              align="left"
            />
            <View style={styles.options}>
              {moments.map((m, i) => (
                <Animated.View key={m.value} entering={enterUp(3 + i)}>
                  <OptionCard
                    selected={reviewMoment === m.value}
                    icon={m.icon}
                    title={t(`onboarding.moment_${m.value}`)}
                    desc={t(`onboarding.moment_${m.value}Desc`)}
                    onPress={() => setReviewMoment(m.value)}
                  />
                </Animated.View>
              ))}
            </View>
          </StepScroll>
        );
      }
      case 'plan':
        return (
          <StepScroll centered>
            <PlanBuilder
              surahId={alreadyCompleted ? activeSurah : startingSurahForGoal(goal)}
              continuing={alreadyCompleted}
              minutesPerDay={minutesPerDay}
              reminderTime={reminderTime}
              reminderOn={reminderOn}
              setReminderOn={setReminderOn}
              onReady={() => setPlanReady(true)}
            />
          </StepScroll>
        );
    }
  };

  const ctaLabel =
    id === 'welcome'
      ? t('onboarding.welcomeCta')
      : id === 'plan'
        ? alreadyCompleted
          ? t('onboarding.save')
          : t('onboarding.start')
        : t('onboarding.next');

  const showSkip = alreadyCompleted || isScience;

  return (
    <ThemedView style={styles.container}>
      <AmbientBackground step={step} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.topSide}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.back')}
                onPress={() => goTo(step - 1)}
                hitSlop={10}
                style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </Pressable>
            ) : null}
          </View>
          <FlowProgress progress={(step + 1) / STEPS.length} />
          <View style={[styles.topSide, styles.topRight]}>
            {showSkip ? (
              <Pressable
                onPress={() => (alreadyCompleted ? router.back() : goTo(GOAL_STEP))}
                hitSlop={10}>
                <ThemedText type="small" themeColor="textSecondary">
                  {alreadyCompleted ? t('onboarding.close') : t('onboarding.skip')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.flex}>
          <Animated.View
            key={id}
            entering={(direction > 0 ? FadeInRight : FadeInLeft).duration(380)}
            exiting={FadeOut.duration(160)}
            style={styles.stepLayer}>
            {renderStep()}
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={ctaLabel}
            disabled={(id === 'plan' && !planReady) || finishing}
            icon={id === 'plan' ? 'checkmark' : 'arrow-forward'}
            onPress={() => (id === 'plan' ? void finish() : goTo(step + 1))}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  topSide: { width: 56, flexDirection: 'row' },
  topRight: { justifyContent: 'flex-end' },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  stepContent: {
    flexGrow: 1,
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  centered: { justifyContent: 'center' },
  welcome: { alignItems: 'center', gap: Spacing.four },
  brandBlock: { alignItems: 'center', gap: Spacing.two },
  brand: { fontSize: 40, lineHeight: 46, fontWeight: 800, letterSpacing: -1 },
  tagline: { fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  chart: { alignItems: 'center', gap: Spacing.two },
  body: { fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  sunnaContent: { gap: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.five },
  padded: { paddingHorizontal: Spacing.four },
  options: { gap: Spacing.three },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.three,
  },
  outcomeText: { flex: 1 },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, paddingTop: Spacing.two },
});

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';
