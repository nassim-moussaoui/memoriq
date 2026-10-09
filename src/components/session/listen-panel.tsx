import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

import { SpeedPill } from '@/components/speed-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Listens suggested before reciting a new verse (not enforced). */
const LISTEN_TARGET = 3;

const BUTTON = 64;

function Wave({ wave, offset, color }: { wave: SharedValue<number>; offset: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = (wave.value + offset) % 1;
    return {
      opacity: interpolate(p, [0, 1], [0.45, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [1, 1.7]) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: color }, style]} />;
}

/**
 * Listen stage of a new verse: a large play button that ripples while the
 * reciter plays, dots counting the listens, loop and speed controls.
 */
export function ListenPanel({
  playing,
  listens,
  loop,
  onPlay,
  onStop,
  onToggleLoop,
}: {
  playing: boolean;
  listens: number;
  loop: boolean;
  onPlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const wave = useSharedValue(0);

  useEffect(() => {
    if (playing && !reduceMotion) {
      wave.value = 0;
      wave.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
    } else {
      cancelAnimation(wave);
      wave.value = 0;
    }
  }, [playing, reduceMotion, wave]);

  const reached = listens >= LISTEN_TARGET;

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.playWrap}>
        {playing ? (
          <>
            <Wave wave={wave} offset={0} color={theme.tint} />
            <Wave wave={wave} offset={0.5} color={theme.tint} />
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? t('a11y.pause') : t('a11y.playVerse')}
          onPress={() => {
            void Haptics.selectionAsync();
            if (playing) onStop();
            else onPlay();
          }}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: theme.tint, transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}>
          <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#ffffff" style={!playing && styles.playIcon} />
        </Pressable>
      </View>

      <View style={styles.side}>
        <ThemedText style={styles.sideTitle}>
          {reached ? t('session.listenReady') : t('session.listenGoal', { count: LISTEN_TARGET })}
        </ThemedText>
        <View style={styles.dots}>
          {Array.from({ length: LISTEN_TARGET }, (_, i) =>
            i < listens ? (
              <Animated.View
                key={i}
                entering={ZoomIn.springify().damping(12)}
                style={[styles.dot, { backgroundColor: theme.tint }]}>
                <Ionicons name="checkmark" size={11} color="#ffffff" />
              </Animated.View>
            ) : (
              <View key={i} style={[styles.dot, { backgroundColor: theme.backgroundSelected }]} />
            ),
          )}
          {listens > LISTEN_TARGET ? (
            <ThemedText style={[styles.more, { color: theme.tint }]}>{`+${listens - LISTEN_TARGET}`}</ThemedText>
          ) : null}
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: loop }}
            onPress={() => {
              void Haptics.selectionAsync();
              onToggleLoop();
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: loop ? theme.tintSoft : theme.background,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}>
            <Ionicons name="repeat" size={15} color={loop ? theme.tint : theme.textSecondary} />
            <ThemedText type="smallBold" style={{ color: loop ? theme.tint : theme.textSecondary }}>
              {t('surah.loop')}
            </ThemedText>
          </Pressable>
          <SpeedPill surface={theme.background} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    padding: Spacing.three,
  },
  playWrap: { width: BUTTON + 16, height: BUTTON + 16, alignItems: 'center', justifyContent: 'center' },
  wave: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 2,
  },
  play: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 3 },
  side: { flex: 1, gap: Spacing.two },
  sideTitle: { fontSize: 14, lineHeight: 19, fontWeight: 700 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  more: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
});
