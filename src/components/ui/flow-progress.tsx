import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** Thin progress bar for a step-by-step flow, springing to each new value (0 to 1). */
export function FlowProgress({ progress }: { progress: number }) {
  const theme = useTheme();
  const value = useSharedValue(progress);
  useEffect(() => {
    value.value = withSpring(progress, { damping: 20, stiffness: 120 });
  }, [progress, value]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(value.value, 0.02) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.tint }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
