import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * A one-shot burst of confetti in the brand colors (green, gold, blue):
 * pieces shoot up from the top center, then fall while turning and fading.
 * Purely decorative; nothing renders with reduced motion.
 */

const COUNT = 42;

/** Deterministic pseudo-random in [0, 1) so the burst is stable per index. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Piece({ index, width, height, color }: { index: number; width: number; height: number; color: string }) {
  const t = useSharedValue(0);
  const angle = (rand(index) - 0.5) * Math.PI * 0.9; // spread around straight up
  const power = 0.45 + rand(index + 1) * 0.55;
  const spin = (rand(index + 2) - 0.5) * 1440;
  const size = 6 + rand(index + 3) * 7;
  const round = rand(index + 4) > 0.6;
  const delay = rand(index + 5) * 160;
  const duration = 1900 + rand(index + 6) * 900;

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }));
  }, [delay, duration, t]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Ballistic path: launched up and out, then pulled down by "gravity".
    const vx = Math.sin(angle) * width * 0.55 * power;
    const vy = -Math.cos(angle) * height * 0.5 * power;
    const x = vx * p;
    const y = vy * p + height * 0.95 * p * p;
    return {
      opacity: p < 0.08 ? p / 0.08 : p > 0.75 ? Math.max(0, (1 - p) / 0.25) : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${spin * p}deg` },
        { rotateX: `${spin * 0.6 * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: round ? size : size * 0.6,
          height: round ? size : size * 1.5,
          borderRadius: round ? size / 2 : 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduceMotion) return null;
  const colors = [theme.tint, '#E8C468', theme.info, '#D9A53A', theme.tint, '#F6D77E'];
  return (
    <View pointerEvents="none" style={styles.layer}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Piece key={i} index={i} width={width} height={height} color={colors[i % colors.length]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    zIndex: 50,
  },
  piece: { position: 'absolute', top: '22%' },
});
