import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * Active recall by word-by-word reveal. A hidden word is drawn as a soft
 * pill the exact size of the word (so the shape of the verse stays readable),
 * gently breathing in a wave across the line. Tapping it fades the pill out
 * while the word rises into place. Revealing everything animates the same way,
 * so there is never a jump between the masked and the full verse.
 */

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/);
}

type Revealed = ReadonlySet<number> | 'all';

/** Looping 0 → 1 clock shared by every pill of a line (only while needed). */
function useWave(active: boolean): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const wave = useSharedValue(0);
  useEffect(() => {
    if (active && !reduceMotion) {
      wave.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(wave);
    }
  }, [active, reduceMotion, wave]);
  return wave;
}

function MaskedWord({
  word,
  index,
  revealed,
  wave,
  textStyle,
  pillColor,
  pillInset,
  onPress,
}: {
  word: string;
  index: number;
  revealed: boolean;
  wave: SharedValue<number>;
  textStyle: TextStyle | TextStyle[];
  pillColor: string;
  /** Vertical inset of the pill, so it hugs the glyphs rather than the line box. */
  pillInset: number;
  onPress?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    const target = revealed ? 1 : 0;
    shown.value = reduceMotion
      ? target
      : revealed
        ? withSpring(target, { damping: 16, stiffness: 170 })
        : withTiming(target, { duration: 200 });
  }, [reduceMotion, revealed, shown]);

  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shown.value, [0, 0.4, 1], [0, 0.4, 1]),
    transform: [{ translateY: (1 - shown.value) * 6 }],
  }));
  const pillStyle = useAnimatedStyle(() => {
    const breath = 0.5 + 0.5 * Math.sin((wave.value - index * 0.09) * Math.PI * 2);
    return {
      opacity: (1 - shown.value) * (0.7 + 0.3 * breath),
      transform: [{ scaleX: 1 - shown.value * 0.25 }, { scaleY: 1 - shown.value * 0.4 }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={revealed || !onPress}
      hitSlop={6}
      accessibilityRole={revealed ? 'text' : 'button'}>
      <View>
        <Animated.Text style={[textStyle, wordStyle]}>{word}</Animated.Text>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { top: pillInset, bottom: pillInset, backgroundColor: pillColor },
            pillStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

function isShown(revealed: Revealed, i: number) {
  return revealed === 'all' || revealed.has(i);
}

/** The Arabic verse, right to left, each word maskable. */
export function MaskedArabicVerse({
  text,
  revealed,
  onReveal,
  fontScale = 1,
}: {
  text: string;
  revealed: Revealed;
  onReveal?: (index: number) => void;
  fontScale?: number;
}) {
  const theme = useTheme();
  const words = splitWords(text);
  const wave = useWave(revealed !== 'all');
  const fontSize = 28 * fontScale;
  // About 1.8x the font size, the comfortable line height for Uthmani script.
  const lineHeight = Math.round(fontSize * 1.8);
  const wordStyle: TextStyle = { fontSize, lineHeight, color: theme.text };
  return (
    <View style={styles.arabicGrid}>
      {words.map((word, i) => (
        <MaskedWord
          key={`${i}-${word}`}
          word={word}
          index={i}
          revealed={isShown(revealed, i)}
          wave={wave}
          textStyle={[styles.arabicWord, wordStyle]}
          pillColor={theme.backgroundSelected}
          pillInset={lineHeight * 0.24}
          onPress={onReveal ? () => onReveal(i) : undefined}
        />
      ))}
    </View>
  );
}

/**
 * The phonetic line under the verse. Same reveal state as the Arabic; during
 * recall the words already revealed are tinted so the learner sees progress.
 */
export function PhoneticLine({
  text,
  revealed,
  onReveal,
}: {
  text: string;
  revealed: Revealed;
  onReveal?: (index: number) => void;
}) {
  const theme = useTheme();
  const words = splitWords(text);
  const wave = useWave(revealed !== 'all');
  return (
    <View style={styles.phoneticGrid}>
      {words.map((word, i) => (
        <MaskedWord
          key={`${i}-${word}`}
          word={word}
          index={i}
          revealed={isShown(revealed, i)}
          wave={wave}
          textStyle={[
            styles.phoneticWord,
            { color: revealed === 'all' ? theme.textSecondary : theme.tint },
          ]}
          pillColor={theme.backgroundSelected}
          pillInset={3}
          onPress={onReveal ? () => onReveal(i) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  arabicGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 10,
  },
  arabicWord: { writingDirection: 'rtl' },
  phoneticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 7,
    rowGap: 2,
  },
  phoneticWord: {
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    fontWeight: 500,
  },
  pill: {
    position: 'absolute',
    left: -2,
    right: -2,
    borderRadius: 999,
  },
});
