import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Progressive concealment for active recall (the testing effect):
 *  - level 0: full text (reveal / reading)
 *  - level 1: first letter of each word (strong hint)
 *  - level 2: everything masked (pure retrieval)
 */
export type MaskLevel = 0 | 1 | 2;

const TATWEEL = 'ـ';

function maskWord(word: string, level: MaskLevel): string {
  if (level === 0) return word;
  if (level === 1) return word[0] + TATWEEL.repeat(2);
  return TATWEEL.repeat(3);
}

export function MaskedVerse({
  text,
  level,
  fontScale = 1,
}: {
  text: string;
  level: MaskLevel;
  fontScale?: number;
}) {
  const theme = useTheme();
  const content = useMemo(() => {
    if (level === 0) return text;
    return text
      .split(/\s+/)
      .map((w) => maskWord(w, level))
      .join('   ');
  }, [text, level]);

  return (
    <Text
      style={[
        styles.arabic,
        {
          fontSize: 28 * fontScale,
          lineHeight: 52 * fontScale,
          color: level === 0 ? theme.text : theme.textSecondary,
        },
      ]}>
      {content}
    </Text>
  );
}

export function ArabicVerse({ text, fontScale = 1 }: { text: string; fontScale?: number }) {
  return <MaskedVerse text={text} level={0} fontScale={fontScale} />;
}

const styles = StyleSheet.create({
  arabic: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
