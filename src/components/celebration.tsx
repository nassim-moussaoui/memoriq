import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * End-of-session celebration: the checkmark springs in while a ring of
 * particles bursts outward and fades. Falls back to a static mark when the
 * system asks for reduced motion.
 */

const PARTICLES = 10;
const RADIUS = 62;

function Particle({ index, active }: { index: number; active: boolean }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const angle = (index / PARTICLES) * 2 * Math.PI;

  useEffect(() => {
    if (!active) return;
    progress.value = withDelay(
      120 + index * 18,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
    );
  }, [active, index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * RADIUS * progress.value },
      { translateY: Math.sin(angle) * RADIUS * progress.value },
      { scale: 1 - progress.value * 0.4 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { backgroundColor: index % 2 === 0 ? theme.tint : theme.info },
        style,
      ]}
    />
  );
}

export function Celebration() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.4);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.15, { duration: 260, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 8, stiffness: 140 }),
    );
  }, [reduceMotion, scale]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.wrap}>
      {!reduceMotion &&
        Array.from({ length: PARTICLES }, (_, i) => (
          <Particle key={i} index={i} active={!reduceMotion} />
        ))}
      <Animated.View style={markStyle}>
        <Ionicons name="checkmark-circle" size={72} color={theme.tint} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', height: 110, width: 180 },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
