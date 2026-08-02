import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

const RATES = [0.75, 1, 1.25] as const;

/**
 * Recitation speed control. Slowing the reciter down is the classic way to
 * work on a hard verse, so the control lives next to the play buttons rather
 * than buried in settings.
 */
export function SpeedPill() {
  const { t } = useTranslation();
  const theme = useTheme();
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const slowed = playbackRate !== 1;

  const cycle = () => {
    void Haptics.selectionAsync();
    const index = RATES.indexOf(playbackRate);
    setPlaybackRate(RATES[(index + 1) % RATES.length]);
  };

  return (
    <Pressable
      onPress={cycle}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.speed')}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: slowed ? theme.tintSoft : theme.backgroundElement,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}>
      <Ionicons name="speedometer-outline" size={16} color={slowed ? theme.tint : theme.textSecondary} />
      <ThemedText type="smallBold" style={slowed ? { color: theme.tint } : undefined}>
        {playbackRate}x
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
