import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Same color and mark size as the native splash (app.json), for a seamless handoff. */
export const SPLASH_BACKGROUND = '#0B7A5C';
const MARK_SIZE = 200;
const DURATION = 650;

const overlayKeyframe = new Keyframe({
  0: { opacity: 1 },
  35: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.cubic) },
});

const markKeyframe = new Keyframe({
  0: { transform: [{ scale: 1 }], opacity: 1 },
  35: { transform: [{ scale: 0.92 }], opacity: 1, easing: Easing.out(Easing.quad) },
  100: { transform: [{ scale: 1.6 }], opacity: 0, easing: Easing.in(Easing.cubic) },
});

/**
 * Takes over from the native splash screen: the Memoriq mark on the brand
 * green, which dips then grows and fades away to reveal the app.
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(Platform.OS !== 'web');

  if (!visible) return null;

  const mark = (
    <Image style={styles.mark} source={require('@/assets/images/splash-icon.png')} contentFit="contain" />
  );

  return animate ? (
    <Animated.View
      pointerEvents="none"
      entering={overlayKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.overlay}>
      <Animated.View entering={markKeyframe.duration(DURATION)}>{mark}</Animated.View>
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => setAnimate(true));
      }}
      style={styles.overlay}>
      {mark}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
});
