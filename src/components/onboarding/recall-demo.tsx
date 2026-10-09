import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TestingEffectChart } from '@/components/onboarding/charts';
import { Card } from '@/components/onboarding/primitives';
import { MaskedArabicVerse, PhoneticLine, splitWords } from '@/components/recall-verse';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getChapter, getVerses } from '@/lib/quran';

const DEMO_SURAH = 112;

/** Tapping finger that nudges the learner until the first word is revealed. */
function TapHint({ label }: { label: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pulse.value * 4 }, { scale: 1 - pulse.value * 0.08 }],
  }));
  return (
    <Animated.View entering={FadeIn.delay(900)} exiting={FadeOut} style={styles.hint}>
      <Animated.View style={iconStyle}>
        <Ionicons name="hand-left-outline" size={18} color={theme.tint} />
      </Animated.View>
      <ThemedText type="small" style={{ color: theme.tint }}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * Live taste of a Memoriq review on the first verse of Al-Ikhlas: the verse
 * is masked, the learner recites it, then taps each word to check. Once the
 * verse is complete, the testing-effect chart explains why this works.
 */
export function RecallDemo({ chartWidth }: { chartWidth: number }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const verse = getVerses(DEMO_SURAH)[0];
  const chapter = getChapter(DEMO_SURAH);
  const total = splitWords(verse.ar).length;
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const done = revealed.size >= total;

  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const reveal = (index: number) => {
    if (revealed.has(index)) return;
    const next = new Set(revealed);
    next.add(index);
    setRevealed(next);
    if (next.size >= total) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cardScale.set(
        withSequence(withTiming(1.035, { duration: 140 }), withSpring(1, { damping: 9, stiffness: 180 })),
      );
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const revealAll = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRevealed(new Set(Array.from({ length: total }, (_, i) => i)));
  };

  const surahName = i18n.language.startsWith('fr') ? chapter.nameFr : chapter.nameEn;

  return (
    <View style={styles.wrap}>
      <Animated.View style={cardStyle}>
        <Card style={[styles.card, done && { backgroundColor: theme.tintSoft }]}>
          <View style={styles.cardTop}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {`${chapter.nameSimple} · ${surahName}`}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {`${revealed.size}/${total}`}
            </ThemedText>
          </View>
          <MaskedArabicVerse text={verse.ar} revealed={done ? 'all' : revealed} onReveal={reveal} />
          <PhoneticLine text={verse.tr} revealed={done ? 'all' : revealed} onReveal={reveal} />
          {done ? (
            <Animated.View entering={FadeIn.duration(500)}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {i18n.language.startsWith('fr') ? verse.fr : verse.en}
              </ThemedText>
            </Animated.View>
          ) : null}
        </Card>
      </Animated.View>

      {done ? (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.result}>
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
            <ThemedText type="smallBold" style={[styles.doneText, { color: theme.tint }]}>
              {t('onboarding.recallDone')}
            </ThemedText>
          </View>
          <TestingEffectChart
            active
            width={chartWidth}
            rereadLabel={t('onboarding.recallReread')}
            retrievalLabel={t('onboarding.recallRetrieval')}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('onboarding.recallScience')}
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={styles.pending}>
          {revealed.size === 0 ? <TapHint label={t('onboarding.recallHint')} /> : null}
          <Pressable onPress={revealAll} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
              {t('onboarding.recallRevealAll')}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: { gap: Spacing.three, paddingVertical: Spacing.four },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { textAlign: 'center' },
  result: { alignItems: 'center', gap: Spacing.two },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  doneText: { flexShrink: 1 },
  pending: { alignItems: 'center', gap: Spacing.three, minHeight: 60 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  underline: { textDecorationLine: 'underline' },
});
