import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { splitWords } from '@/components/recall-verse';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Closed star polygon alternating outer/inner radius: path data + perimeter. */
function starPolygon(c: number, outer: number, inner: number, points: number, rotation: number) {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points - Math.PI / 2;
    vertices.push({ x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) });
  }
  let length = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const d =
    vertices.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') +
    ' Z';
  return { d, length, vertices };
}

function DrawnStroke({
  progress,
  from,
  to,
  d,
  length,
  color,
  width,
}: {
  progress: SharedValue<number>;
  from: number;
  to: number;
  d: string;
  length: number;
  color: string;
  width: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(progress.value, [from, to], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: length * (1 - t) };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

function VertexDot({
  progress,
  at,
  cx,
  cy,
  color,
}: {
  progress: SharedValue<number>;
  at: number;
  cx: number;
  cy: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(progress.value, [at, at + 0.08], [0, 1], Extrapolation.CLAMP);
    return { r: Easing.out(Easing.back(3))(t) * 3.2, opacity: t };
  });
  return <AnimatedCircle cx={cx} cy={cy} fill={color} animatedProps={animatedProps} />;
}

/**
 * The welcome emblem: an eight-pointed star (khatam), the classic motif of
 * Islamic geometric art. It draws itself stroke by stroke, fills with a soft
 * glow, then keeps turning very slowly while two halos breathe behind it.
 */
export function GeometricStar({ size }: { size: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    draw.value = withDelay(150, withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }));
    spin.value = withRepeat(withTiming(1, { duration: 90000, easing: Easing.linear }), -1, false);
    breath.value = withDelay(
      1600,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [breath, draw, reduceMotion, spin]);

  const c = size / 2;
  const outerR = size * 0.44;
  // Two squares rotated 45 degrees: the inner vertices sit at cos45/cos22.5.
  const outer = starPolygon(c, outerR, outerR * 0.765, 8, 0);
  const inner = starPolygon(c, outerR * 0.6, outerR * 0.6 * 0.765, 8, Math.PI / 8);
  const ringR = outerR * 0.3;
  const ringLength = 2 * Math.PI * ringR;

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const fillProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.7, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const haloStyle = (phase: number) => {
    'worklet';
    return {
      transform: [{ scale: interpolate((breath.value + phase) % 1, [0, 1], [0.86, 1.08]) }],
      opacity: interpolate(draw.value, [0.6, 1], [0, 1], Extrapolation.CLAMP) * 0.9,
    };
  };
  const halo1 = useAnimatedStyle(() => haloStyle(0));
  const halo2 = useAnimatedStyle(() => haloStyle(0.5));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[styles.halo, { borderColor: theme.tintSoft, borderRadius: size / 2 }, halo1]}
      />
      <Animated.View
        style={[
          styles.halo,
          { borderColor: theme.tintSoft, borderRadius: size / 2, margin: size * 0.08 },
          halo2,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="starFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.tint} stopOpacity={0.28} />
              <Stop offset="1" stopColor={theme.info} stopOpacity={0.12} />
            </LinearGradient>
          </Defs>
          <AnimatedPath d={outer.d} fill="url(#starFill)" animatedProps={fillProps} />
          <DrawnStroke
            progress={draw}
            from={0}
            to={0.65}
            d={outer.d}
            length={outer.length}
            color={theme.tint}
            width={2.2}
          />
          <DrawnStroke
            progress={draw}
            from={0.25}
            to={0.85}
            d={inner.d}
            length={inner.length}
            color={theme.tint}
            width={1.4}
          />
          <DrawnStroke
            progress={draw}
            from={0.5}
            to={0.95}
            d={`M${c},${c - ringR} a${ringR},${ringR} 0 1,1 0,${ringR * 2} a${ringR},${ringR} 0 1,1 0,${-ringR * 2}`}
            length={ringLength}
            color={theme.tint}
            width={1.4}
          />
          {outer.vertices
            .filter((_, i) => i % 2 === 0)
            .map((p, i) => (
              <VertexDot
                key={i}
                progress={draw}
                at={0.62 + i * 0.04}
                cx={p.x}
                cy={p.y}
                color={theme.tint}
              />
            ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * An Arabic verse whose words appear one after the other (right to left),
 * followed by its translation and reference.
 */
export function RevealedVerse({
  arabic,
  translation,
  source,
  delay = 0,
}: {
  arabic: string;
  translation: string;
  source: string;
  delay?: number;
}) {
  const theme = useTheme();
  const words = splitWords(arabic);
  const wordsDone = delay + words.length * 160;
  return (
    <View style={styles.verse}>
      <View style={styles.arabicRow}>
        {words.map((word, i) => (
          <Animated.Text
            key={`${i}-${word}`}
            entering={FadeIn.delay(delay + i * 160).duration(600)}
            style={[styles.arabicWord, { color: theme.text }]}>
            {word}
          </Animated.Text>
        ))}
      </View>
      <Animated.View entering={FadeIn.delay(wordsDone + 150).duration(700)} style={styles.gap}>
        <ThemedText themeColor="textSecondary" style={styles.translation}>
          {translation}
        </ThemedText>
        <ThemedText style={[styles.source, { color: theme.tint }]}>{source}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 1.5 },
  verse: { alignItems: 'center', gap: Spacing.three },
  arabicRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 10,
  },
  arabicWord: { fontSize: 26, lineHeight: 48, writingDirection: 'rtl' },
  gap: { alignItems: 'center', gap: Spacing.one },
  translation: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', fontStyle: 'italic' },
  source: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 0.4 },
});
