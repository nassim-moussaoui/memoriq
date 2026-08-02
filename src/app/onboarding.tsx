import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type FlatList,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChartLegend,
  ForgettingCurveChart,
  SpacedRepetitionChart,
  TestingEffectChart,
} from '@/components/onboarding-charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppStore, type Goal, type ReviewMoment } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

const SLIDE_COUNT = 5;
const SLIDES = [0, 1, 2, 3, 4];

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Fades/slides its children in when the slide becomes active (with a stagger). */
function Reveal({
  active,
  delay = 0,
  style,
  children,
}: {
  active: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  useEffect(() => {
    if (active) {
      shown.value = reduceMotion
        ? 1
        : withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
    } else {
      shown.value = 0;
    }
  }, [active, delay, reduceMotion, shown]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 16 }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Pager dot that stretches into a pill and tints as its page approaches. */
function PagerDot({
  index,
  scrollX,
  slideWidth,
  activeColor,
  inactiveColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  slideWidth: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = scrollX.value / slideWidth;
    return {
      width: interpolate(p, [index - 1, index, index + 1], [8, 22, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        p,
        [index - 1, index, index + 1],
        [inactiveColor, activeColor, inactiveColor],
      ),
    };
  });
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

function IconBadge({ icon }: { icon: IconName }) {
  const theme = useTheme();
  return (
    <View style={[styles.iconBadge, { backgroundColor: theme.tintSoft }]}>
      <Ionicons name={icon} size={22} color={theme.tint} />
    </View>
  );
}

function ScienceSlide({
  active,
  width,
  icon,
  title,
  body,
  caption,
  chart,
  legend,
}: {
  active: boolean;
  width: number;
  icon: IconName;
  title: string;
  body: string;
  caption?: string;
  chart: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <View style={[styles.slide, { width }]}>
      <Reveal active={active} style={styles.chartBlock}>
        {chart}
        {caption ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {caption}
          </ThemedText>
        ) : null}
        {legend}
      </Reveal>
      <Reveal active={active} delay={140} style={styles.titleBlock}>
        <IconBadge icon={icon} />
        <ThemedText style={[styles.title, styles.center]}>{title}</ThemedText>
      </Reveal>
      <Reveal active={active} delay={280}>
        <ThemedText themeColor="textSecondary" style={[styles.body, styles.center]}>
          {body}
        </ThemedText>
      </Reveal>
    </View>
  );
}

const TEACHING_ICONS = [
  'ear-outline',
  'repeat-outline',
  'moon-outline',
  'trending-up-outline',
] as const;

function MethodSlide({ active, width }: { active: boolean; width: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const teachings = TEACHING_ICONS.map((icon, i) => ({
    icon,
    title: t(`onboarding.slide4Card${i + 1}Title`),
    quote: t(`onboarding.slide4Card${i + 1}Quote`),
    narrator: t(`onboarding.slide4Card${i + 1}Narrator`),
    source: t(`onboarding.slide4Card${i + 1}Source`),
    method: t(`onboarding.slide4Card${i + 1}Method`),
  }));
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.methodContent}
      showsVerticalScrollIndicator={false}>
      <Reveal active={active} style={styles.titleBlock}>
        <IconBadge icon="book-outline" />
        <ThemedText style={[styles.title, styles.center]}>{t('onboarding.slide4Title')}</ThemedText>
      </Reveal>
      {teachings.map((teaching, i) => (
        <Reveal key={teaching.icon} active={active} delay={140 + i * 100} style={styles.teaching}>
          <View style={styles.teachingHeader}>
            <Ionicons name={teaching.icon} size={18} color={theme.tint} />
            <ThemedText type="smallBold" style={styles.teachingTitle}>
              {teaching.title}
            </ThemedText>
          </View>
          <View style={[styles.quoteBlock, { borderStartColor: theme.tint }]}>
            <ThemedText type="small" style={styles.quoteText}>
              {teaching.quote}
            </ThemedText>
            <ThemedText style={[styles.quoteSource, { color: theme.textSecondary }]}>
              {teaching.narrator}
            </ThemedText>
            <ThemedText style={[styles.quoteSource, { color: theme.textSecondary }]}>
              {teaching.source}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {t('onboarding.slide4MethodLabel')}
            </ThemedText>{' '}
            {teaching.method}
          </ThemedText>
        </Reveal>
      ))}
      <Reveal active={active} delay={560}>
        <ThemedText themeColor="textSecondary" style={[styles.body, styles.center]}>
          {t('onboarding.slide4Body')}
        </ThemedText>
      </Reveal>
    </ScrollView>
  );
}

function OptionRow({
  selected,
  icon,
  title,
  desc,
  onPress,
}: {
  selected: boolean;
  icon: IconName;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.optionRow,
        {
          backgroundColor: selected ? theme.tintSoft : theme.backgroundElement,
          borderColor: selected ? theme.tint : 'transparent',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      <Ionicons name={icon} size={20} color={selected ? theme.tint : theme.textSecondary} />
      <View style={styles.optionTextCol}>
        <ThemedText type="small" style={selected ? { color: theme.tint } : undefined}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>{desc}</ThemedText>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? theme.tint : theme.backgroundSelected}
      />
    </Pressable>
  );
}

function TimeCard({
  selected,
  minutes,
  tag,
  onPress,
}: {
  selected: boolean;
  minutes: number;
  tag: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.timeCard,
        {
          backgroundColor: selected ? theme.tintSoft : theme.backgroundElement,
          borderColor: selected ? theme.tint : 'transparent',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}>
      <ThemedText style={[styles.timeValue, selected ? { color: theme.tint } : undefined]}>
        {minutes}
      </ThemedText>
      <ThemedText type="small" style={selected ? { color: theme.tint } : undefined}>
        {t('onboarding.minUnit')}
      </ThemedText>
      <ThemedText style={[styles.timeTag, { color: theme.textSecondary }]}>{tag}</ThemedText>
    </Pressable>
  );
}

function SetupSlide({
  active,
  width,
  goal,
  setGoal,
  minutesPerDay,
  setMinutesPerDay,
  reviewMoment,
  setReviewMoment,
}: {
  active: boolean;
  width: number;
  goal: Goal;
  setGoal: (g: Goal) => void;
  minutesPerDay: 5 | 10 | 20;
  setMinutesPerDay: (m: 5 | 10 | 20) => void;
  reviewMoment: ReviewMoment;
  setReviewMoment: (m: ReviewMoment) => void;
}) {
  const { t } = useTranslation();
  const goals: { value: Goal; icon: IconName; title: string; desc: string }[] = [
    {
      value: 'juzamma',
      icon: 'book-outline',
      title: t('onboarding.goalJuz'),
      desc: t('onboarding.goalJuzDesc'),
    },
    {
      value: 'prayer',
      icon: 'heart-outline',
      title: t('onboarding.goalPrayer'),
      desc: t('onboarding.goalPrayerDesc'),
    },
    {
      value: 'hifz',
      icon: 'flag-outline',
      title: t('onboarding.goalHifz'),
      desc: t('onboarding.goalHifzDesc'),
    },
  ];
  const moments: { value: ReviewMoment; icon: IconName; title: string; desc: string }[] = [
    {
      value: 'morning',
      icon: 'sunny-outline',
      title: t('onboarding.momentMorning'),
      desc: t('onboarding.momentMorningDesc'),
    },
    {
      value: 'afterPrayer',
      icon: 'compass-outline',
      title: t('onboarding.momentPrayer'),
      desc: t('onboarding.momentPrayerDesc'),
    },
    {
      value: 'evening',
      icon: 'moon-outline',
      title: t('onboarding.momentEvening'),
      desc: t('onboarding.momentEveningDesc'),
    },
  ];
  const timeTags = { 5: t('onboarding.time5'), 10: t('onboarding.time10'), 20: t('onboarding.time20') };
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.setupContent}
      showsVerticalScrollIndicator={false}>
      <Reveal active={active} style={styles.titleBlock}>
        <IconBadge icon="options-outline" />
        <ThemedText style={[styles.title, styles.center]}>{t('onboarding.setupTitle')}</ThemedText>
      </Reveal>

      <Reveal active={active} delay={120} style={styles.setupSection}>
        <ThemedText type="smallBold">{t('onboarding.goalLabel')}</ThemedText>
        {goals.map((g) => (
          <OptionRow
            key={g.value}
            selected={goal === g.value}
            icon={g.icon}
            title={g.title}
            desc={g.desc}
            onPress={() => setGoal(g.value)}
          />
        ))}
      </Reveal>

      <Reveal active={active} delay={240} style={styles.setupSection}>
        <ThemedText type="smallBold">{t('onboarding.timeLabel')}</ThemedText>
        <View style={styles.timeRow}>
          {([5, 10, 20] as const).map((m) => (
            <TimeCard
              key={m}
              selected={minutesPerDay === m}
              minutes={m}
              tag={timeTags[m]}
              onPress={() => setMinutesPerDay(m)}
            />
          ))}
        </View>
      </Reveal>

      <Reveal active={active} delay={340} style={styles.setupSection}>
        <ThemedText type="smallBold">{t('onboarding.momentLabel')}</ThemedText>
        {moments.map((m) => (
          <OptionRow
            key={m.value}
            selected={reviewMoment === m.value}
            icon={m.icon}
            title={m.title}
            desc={m.desc}
            onPress={() => setReviewMoment(m.value)}
          />
        ))}
      </Reveal>
    </ScrollView>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const listRef = useAnimatedRef<FlatList<number>>();
  const [page, setPage] = useState(0);
  const scrollX = useSharedValue(0);

  const slideWidth = Math.min(width, MaxContentWidth);
  const chartWidth = Math.min(slideWidth - Spacing.four * 2, 340);

  const alreadyCompleted = useAppStore((s) => s.onboardingCompleted);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const storedGoal = useAppStore((s) => s.goal);
  const storedMinutes = useAppStore((s) => s.minutesPerDay);
  const storedMoment = useAppStore((s) => s.reviewMoment);

  // When revisiting from the Profile, start from the saved plan so walking
  // through the slides never silently resets it.
  const [goal, setGoal] = useState<Goal>(alreadyCompleted ? storedGoal : 'juzamma');
  const [minutesPerDay, setMinutesPerDay] = useState<5 | 10 | 20>(
    alreadyCompleted ? storedMinutes : 10,
  );
  const [reviewMoment, setReviewMoment] = useState<ReviewMoment>(
    alreadyCompleted ? storedMoment : 'evening',
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Activate a slide as soon as it fills more than half the screen, so its
  // animations start while the swipe settles.
  useAnimatedReaction(
    () => Math.round(scrollX.value / slideWidth),
    (index, previous) => {
      if (index !== previous && index >= 0 && index < SLIDE_COUNT) {
        runOnJS(setPage)(index);
      }
    },
    [slideWidth],
  );

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const finish = () => {
    completeOnboarding({ minutesPerDay, goal, reviewMoment });
    if (alreadyCompleted) router.back();
    else router.replace('/');
  };

  const skip = () => {
    if (alreadyCompleted) router.back();
    else goTo(SLIDE_COUNT - 1);
  };

  const renderSlide = ({ item }: { item: number }) => {
    const active = page === item;
    if (item === 0) {
      return (
        <ScienceSlide
          active={active}
          width={slideWidth}
          icon="trending-down-outline"
          title={t('onboarding.slide1Title')}
          body={t('onboarding.slide1Body')}
          caption={t('onboarding.slide1Caption')}
          chart={
            <ForgettingCurveChart
              active={active}
              width={chartWidth}
              xLabel={t('onboarding.axisDays')}
            />
          }
        />
      );
    }
    if (item === 1) {
      return (
        <ScienceSlide
          active={active}
          width={slideWidth}
          icon="calendar-outline"
          title={t('onboarding.slide2Title')}
          body={t('onboarding.slide2Body')}
          chart={
            <SpacedRepetitionChart
              active={active}
              width={chartWidth}
              xLabel={t('onboarding.axisDays')}
            />
          }
          legend={
            <ChartLegend
              items={[
                { color: theme.tint, label: t('onboarding.slide2With') },
                { color: theme.textSecondary, muted: true, label: t('onboarding.slide2Without') },
              ]}
            />
          }
        />
      );
    }
    if (item === 2) {
      return (
        <ScienceSlide
          active={active}
          width={slideWidth}
          icon="mic-outline"
          title={t('onboarding.slide3Title')}
          body={t('onboarding.slide3Body')}
          caption={t('onboarding.slide3Caption')}
          chart={
            <TestingEffectChart
              active={active}
              width={chartWidth}
              rereadLabel={t('onboarding.slide3Reread')}
              retrievalLabel={t('onboarding.slide3Retrieval')}
            />
          }
        />
      );
    }
    if (item === 3) {
      return <MethodSlide active={active} width={slideWidth} />;
    }
    return (
      <SetupSlide
        active={active}
        width={slideWidth}
        goal={goal}
        setGoal={setGoal}
        minutesPerDay={minutesPerDay}
        setMinutesPerDay={setMinutesPerDay}
        reviewMoment={reviewMoment}
        setReviewMoment={setReviewMoment}
      />
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

        <Animated.FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(n) => String(n)}
          renderItem={renderSlide}
          extraData={page}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: slideWidth,
            offset: slideWidth * index,
            index,
          })}
        />

        <View style={styles.dots}>
          {SLIDES.map((i) => (
            <PagerDot
              key={i}
              index={i}
              scrollX={scrollX}
              slideWidth={slideWidth}
              activeColor={theme.tint}
              inactiveColor={theme.backgroundSelected}
            />
          ))}
        </View>

        <Pressable
          onPress={() => (isLast ? finish() : goTo(page + 1))}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.tint, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}>
          <ThemedText type="default" style={styles.primaryButtonText}>
            {isLast
              ? alreadyCompleted
                ? t('onboarding.save')
                : t('onboarding.start')
              : t('onboarding.next')}
          </ThemedText>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
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
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  chartBlock: { alignItems: 'center', gap: Spacing.two },
  titleBlock: { alignItems: 'center', gap: Spacing.three },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, lineHeight: 34, fontWeight: 700 },
  body: { fontSize: 15, lineHeight: 23, maxWidth: 360 },
  center: { textAlign: 'center' },
  methodContent: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.five },
  teaching: { alignSelf: 'stretch', gap: Spacing.two },
  teachingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  teachingTitle: { flex: 1, fontSize: 15 },
  quoteBlock: { borderStartWidth: 3, paddingStart: Spacing.three, gap: Spacing.one },
  quoteText: { fontStyle: 'italic' },
  quoteSource: { fontSize: 11, lineHeight: 15 },
  setupContent: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.five },
  setupSection: { gap: Spacing.two },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  optionTextCol: { flex: 1, gap: 1 },
  optionDesc: { fontSize: 12, lineHeight: 16 },
  timeRow: { flexDirection: 'row', gap: Spacing.two },
  timeCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    gap: 2,
  },
  timeValue: { fontSize: 26, lineHeight: 30, fontWeight: 700 },
  timeTag: { fontSize: 11, lineHeight: 14 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  dot: { height: 8, borderRadius: 4 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: 999,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: { color: '#ffffff', fontWeight: 700 },
});
