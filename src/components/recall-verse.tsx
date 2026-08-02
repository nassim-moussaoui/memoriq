import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Active recall by word-by-word reveal: the verse is visibly written but
 * blurred, and tapping a word (Arabic or phonetic) sharpens it. The blur is a
 * real native Gaussian blur: the word is rendered normally and an expo-blur
 * BlurView (frosted glass) sits on top of it until it is revealed.
 */

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/);
}

function BlurredWord({
  word,
  textStyle,
  intensity,
  onPress,
}: {
  word: string;
  textStyle: TextStyle | TextStyle[];
  intensity: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={6}>
      <View style={styles.blurWrap}>
        <Text style={textStyle}>{word}</Text>
        <BlurView
          intensity={intensity}
          tint="default"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </View>
    </Pressable>
  );
}

/**
 * The Arabic verse. Fully revealed it flows as one centered RTL text; during
 * recall each word is laid out separately (row-reverse wrap) so hidden words
 * can be blurred and tapped individually.
 */
export function BlurredArabicVerse({
  text,
  revealed,
  onReveal,
  fontScale = 1,
}: {
  text: string;
  revealed: ReadonlySet<number> | 'all';
  onReveal?: (index: number) => void;
  fontScale?: number;
}) {
  const theme = useTheme();
  if (revealed === 'all') {
    return (
      <Text
        style={[
          styles.arabicFlow,
          { fontSize: 28 * fontScale, lineHeight: 52 * fontScale, color: theme.text },
        ]}>
        {text}
      </Text>
    );
  }
  const words = splitWords(text);
  const wordStyle: TextStyle = {
    fontSize: 28 * fontScale,
    lineHeight: 40 * fontScale,
    color: theme.text,
  };
  return (
    <View style={styles.arabicGrid}>
      {words.map((word, i) =>
        revealed.has(i) ? (
          <Text key={`${i}-${word}`} style={[styles.arabicWord, wordStyle]}>
            {word}
          </Text>
        ) : (
          <BlurredWord
            key={`${i}-${word}`}
            word={word}
            textStyle={[styles.arabicWord, wordStyle]}
            intensity={40}
            onPress={onReveal ? () => onReveal(i) : undefined}
          />
        ),
      )}
    </View>
  );
}

/**
 * The phonetic line under the verse. Same reveal state as the Arabic; during
 * recall the words just revealed are tinted so the learner sees their progress.
 */
export function PhoneticLine({
  text,
  revealed,
  onReveal,
}: {
  text: string;
  revealed: ReadonlySet<number> | 'all';
  onReveal?: (index: number) => void;
}) {
  const theme = useTheme();
  if (revealed === 'all') {
    return (
      <Text style={[styles.phoneticFlow, { color: theme.textSecondary }]}>{text}</Text>
    );
  }
  const words = splitWords(text);
  return (
    <View style={styles.phoneticGrid}>
      {words.map((word, i) =>
        revealed.has(i) ? (
          <Text key={`${i}-${word}`} style={[styles.phoneticWord, { color: theme.tint }]}>
            {word}
          </Text>
        ) : (
          <BlurredWord
            key={`${i}-${word}`}
            word={word}
            textStyle={[styles.phoneticWord, { color: theme.textSecondary }]}
            intensity={35}
            onPress={onReveal ? () => onReveal(i) : undefined}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  arabicFlow: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  arabicGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: 12,
    rowGap: 6,
  },
  arabicWord: {
    writingDirection: 'rtl',
  },
  phoneticFlow: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 26,
    fontStyle: 'italic',
    fontWeight: 500,
  },
  phoneticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 4,
  },
  phoneticWord: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    fontWeight: 500,
  },
  blurWrap: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 2,
  },
});
