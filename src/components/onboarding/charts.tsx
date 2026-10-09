import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { AnimatedCounter } from '@/components/onboarding/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Animated educational charts for the onboarding. Design rules: one accent hue
 * (theme.tint) for the story series, de-emphasized gray for the comparison
 * (identity also carried by stroke weight + legend, never color alone), 2px
 * lines, hairline solid grid, selective direct labels, text in text tokens.
 * Charts draw themselves on mount (or when `active` flips to true).
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const H = 200;
const PAD = { top: 18, right: 18, bottom: 30, left: 44 };
const PLOT_H = H - PAD.top - PAD.bottom;
const MAX_DAY = 30;
const BAR_W = 24;

function yScale(retention: number): number {
  'worklet';
  return PAD.top + (1 - retention) * PLOT_H;
}

type Pt = { x: number; y: number };
type Window = readonly [number, number];

/** Path data + arc length of a sampled polyline (for stroke-dash drawing). */
function polyline(points: Pt[]) {
  let length = 0;
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cum.push(length);
  }
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  return { d, length, cum };
}

function decayPoints(
  xOf: (day: number) => number,
  from: number,
  to: number,
  stability: number,
): Pt[] {
  const pts: Pt[] = [];
  const step = (to - from) / 48;
  for (let d = from; d <= to + 1e-6; d += step) {
    pts.push({ x: xOf(d), y: yScale(Math.exp(-(d - from) / stability)) });
  }
  return pts;
}

/**
 * Master timeline of a chart: 0 → 1 (linear, so sub-windows map to exact
 * fractions of the drawing). Restarts whenever `active` becomes true.
 */
function useChartProgress(active: boolean, duration: number): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = reduceMotion
        ? 1
        : withDelay(250, withTiming(1, { duration, easing: Easing.linear }));
    } else {
      progress.value = 0;
    }
  }, [active, duration, progress, reduceMotion]);
  return progress;
}

/** A line that draws itself left → right inside its window of the timeline. */
function DrawnPath({
  progress,
  window: win,
  d,
  length,
  color,
  strokeWidth = 2,
  opacity = 1,
}: {
  progress: SharedValue<number>;
  window: Window;
  d: string;
  length: number;
  color: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(progress.value, [win[0], win[1]], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: length * (1 - t) };
  });
  return (
    <AnimatedPath
      d={d}
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={strokeWidth}
      opacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      fill="none"
    />
  );
}

/** A marker dot (with its 2px surface ring) popping in at `at`. */
function PopDot({
  progress,
  at,
  cx,
  cy,
  color,
  surface,
}: {
  progress: SharedValue<number>;
  at: number;
  cx: number;
  cy: number;
  color: string;
  surface: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(progress.value, [at, Math.min(at + 0.06, 1)], [0, 1], Extrapolation.CLAMP);
    const k = Easing.out(Easing.back(2.2))(t);
    return { r: Math.max(k * 5, 0), opacity: t === 0 ? 0 : 1 };
  });
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={color}
      stroke={surface}
      strokeWidth={2}
      animatedProps={animatedProps}
    />
  );
}

/** Fades its children in once the timeline reaches `at`. */
function FadeG({
  progress,
  at,
  children,
}: {
  progress: SharedValue<number>;
  at: number;
  children: ReactNode;
}) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [at, Math.min(at + 0.1, 1)], [0, 1], Extrapolation.CLAMP),
  }));
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>;
}

/** Recessive frame: hairline grid at 100/50%, baseline, y ticks, x label. */
function Frame({
  width,
  xLabel,
  children,
}: {
  width: number;
  xLabel?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const right = width - PAD.right;
  return (
    <Svg width={width} height={H}>
      {[1, 0.5].map((r) => (
        <Line
          key={r}
          x1={PAD.left}
          y1={yScale(r)}
          x2={right}
          y2={yScale(r)}
          stroke={theme.backgroundElement}
          strokeWidth={1}
        />
      ))}
      <Line
        x1={PAD.left}
        y1={yScale(0)}
        x2={right}
        y2={yScale(0)}
        stroke={theme.backgroundSelected}
        strokeWidth={1}
      />
      <SvgText x={PAD.left - 8} y={yScale(1) + 3.5} fontSize={10} fill={theme.textSecondary} textAnchor="end">
        100 %
      </SvgText>
      <SvgText x={PAD.left - 8} y={yScale(0.5) + 3.5} fontSize={10} fill={theme.textSecondary} textAnchor="end">
        50 %
      </SvgText>
      {xLabel ? (
        <SvgText x={(PAD.left + right) / 2} y={H - 8} fontSize={10} fill={theme.textSecondary} textAnchor="middle">
          {xLabel}
        </SvgText>
      ) : null}
      {children}
    </Svg>
  );
}

const FORGET_STABILITY = 6;

/**
 * Step "forgetting": the Ebbinghaus curve draws itself down while a dot rides
 * the tip of the pen. Above the chart, the day and the memory still retained
 * count live with the dot, so the drop is felt, not just seen.
 */
export function ForgettingCurveChart({
  width,
  xLabel,
  dayPrefix,
  memoryLabel,
  halfLabel,
}: {
  width: number;
  xLabel: string;
  dayPrefix: string;
  memoryLabel: string;
  halfLabel: string;
}) {
  const theme = useTheme();
  const progress = useChartProgress(true, 2600);
  const plotW = width - PAD.left - PAD.right;
  const xOf = (day: number) => PAD.left + (day / MAX_DAY) * plotW;

  const pts = decayPoints(xOf, 0, MAX_DAY, FORGET_STABILITY);
  const { d, length, cum } = polyline(pts);
  const areaD = `${d} L${xOf(MAX_DAY).toFixed(1)},${yScale(0)} L${xOf(0).toFixed(1)},${yScale(0)} Z`;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);

  const DRAW: Window = [0, 0.92];
  const halfDay = FORGET_STABILITY * Math.LN2;
  // Fraction of the arc length where the curve crosses the 50% gridline.
  const halfIndex = Math.max(pts.findIndex((p) => p.y >= yScale(0.5)), 0);
  const halfAt = (cum[halfIndex] / length) * DRAW[1];

  // Position of the pen tip, found by walking the arc length (UI thread).
  const tip = useDerivedValue(() => {
    const t = interpolate(progress.value, [DRAW[0], DRAW[1]], [0, 1], Extrapolation.CLAMP);
    const target = t * length;
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < target) i++;
    const span = cum[i + 1] - cum[i];
    const f = span > 0 ? Math.min(Math.max((target - cum[i]) / span, 0), 1) : 0;
    const x = xs[i] + (xs[i + 1] - xs[i]) * f;
    const y = ys[i] + (ys[i + 1] - ys[i]) * f;
    const day = ((x - PAD.left) / plotW) * MAX_DAY;
    return { x, y, day, retention: Math.exp(-day / FORGET_STABILITY) };
  });
  const dayValue = useDerivedValue(() => tip.value.day);
  const percentValue = useDerivedValue(() => tip.value.retention * 100);

  const tipProps = useAnimatedProps(() => ({
    cx: tip.value.x,
    cy: tip.value.y,
    opacity: progress.value > 0 ? 1 : 0,
  }));
  const haloProps = useAnimatedProps(() => ({
    cx: tip.value.x,
    cy: tip.value.y,
    opacity: progress.value > 0 ? 0.25 : 0,
  }));
  const guideProps = useAnimatedProps(() => ({
    x1: tip.value.x,
    x2: tip.value.x,
    y1: tip.value.y,
    opacity: progress.value > 0 ? 1 : 0,
  }));

  return (
    <View style={styles.chartWrap}>
      <View style={styles.readout}>
        <AnimatedCounter
          value={percentValue}
          suffix=" %"
          style={[styles.bigNumber, { color: theme.tint }]}
        />
        <View style={styles.readoutSide}>
          <ThemedText type="small" themeColor="textSecondary">
            {memoryLabel}
          </ThemedText>
          <AnimatedCounter value={dayValue} prefix={dayPrefix} style={styles.dayNumber} />
        </View>
      </View>
      <Frame width={width} xLabel={xLabel}>
        <Defs>
          <LinearGradient id="forgetFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.tint} stopOpacity={0.2} />
            <Stop offset="1" stopColor={theme.tint} stopOpacity={0.01} />
          </LinearGradient>
        </Defs>
        <FadeG progress={progress} at={0.35}>
          <Path d={areaD} fill="url(#forgetFill)" />
        </FadeG>
        <AnimatedLine
          y2={yScale(0)}
          stroke={theme.tint}
          strokeWidth={1}
          strokeDasharray={[3, 4]}
          animatedProps={guideProps}
        />
        <DrawnPath
          progress={progress}
          window={DRAW}
          d={d}
          length={length}
          color={theme.tint}
          strokeWidth={2.5}
        />
        <PopDot
          progress={progress}
          at={halfAt}
          cx={xOf(halfDay)}
          cy={yScale(0.5)}
          color={theme.tint}
          surface={theme.background}
        />
        <FadeG progress={progress} at={halfAt + 0.04}>
          <SvgText
            x={xOf(halfDay) + 9}
            y={yScale(0.5) - 8}
            fontSize={11}
            fontWeight="600"
            fill={theme.text}>
            {halfLabel}
          </SvgText>
        </FadeG>
        <AnimatedCircle r={11} fill={theme.tint} animatedProps={haloProps} />
        <AnimatedCircle
          r={5.5}
          fill={theme.tint}
          stroke={theme.background}
          strokeWidth={2}
          animatedProps={tipProps}
        />
      </Frame>
    </View>
  );
}

/**
 * Slide 2: the gray decay draws first, then one continuous saw-tooth draws in
 * accent: memory decays naturally, shoots back to 100% at each review (dot),
 * and every following decay is flatter than the last.
 */
export function SpacedRepetitionChart({
  width,
  xLabel,
  dayShort,
}: {
  width: number;
  xLabel: string;
  /** Prefix of the review markers ("J" gives "J3"). */
  dayShort: string;
}) {
  const theme = useTheme();
  const progress = useChartProgress(true, 3200);
  const plotW = width - PAD.left - PAD.right;
  const xOf = (day: number) => PAD.left + (day / MAX_DAY) * plotW;

  const gray = polyline(decayPoints(xOf, 0, MAX_DAY, 6));
  const reviews = [
    { day: 0, stability: 4.5 },
    { day: 3, stability: 13 },
    { day: 10, stability: 30 },
    { day: 22, stability: 80 },
  ];
  // One continuous path: consecutive decay segments start back at 100%, so the
  // polyline naturally draws the vertical rise at each review. Remember where
  // each peak sits in the arc length so its dot pops as the pen passes it.
  const pts: Pt[] = [];
  const peakIndices: number[] = [];
  reviews.forEach((r, i) => {
    const end = reviews[i + 1]?.day ?? MAX_DAY;
    if (i > 0) peakIndices.push(pts.length);
    pts.push(...decayPoints(xOf, r.day, end, r.stability));
  });
  const main = polyline(pts);
  const last = reviews[reviews.length - 1];
  const endRetention = Math.exp(-(MAX_DAY - last.day) / last.stability);
  const MAIN: Window = [0.26, 0.96];
  const peakAt = (k: number) =>
    MAIN[0] + (main.cum[peakIndices[k]] / main.length) * (MAIN[1] - MAIN[0]);

  return (
    <Frame width={width} xLabel={xLabel}>
      <DrawnPath
        progress={progress}
        window={[0, 0.22]}
        d={gray.d}
        length={gray.length}
        color={theme.textSecondary}
        opacity={0.4}
      />
      <DrawnPath
        progress={progress}
        window={MAIN}
        d={main.d}
        length={main.length}
        color={theme.tint}
        strokeWidth={2.5}
      />
      {reviews.slice(1).map((r, k) => (
        <G key={r.day}>
          <PopDot
            progress={progress}
            at={peakAt(k)}
            cx={xOf(r.day)}
            cy={yScale(1)}
            color={theme.tint}
            surface={theme.background}
          />
          <FadeG progress={progress} at={peakAt(k)}>
            <SvgText
              x={xOf(r.day)}
              y={yScale(1) - 9}
              fontSize={10.5}
              fontWeight="700"
              fill={theme.tint}
              textAnchor="middle">
              {`${dayShort}${r.day}`}
            </SvgText>
          </FadeG>
        </G>
      ))}
      <FadeG progress={progress} at={0.2}>
        <SvgText
          x={xOf(MAX_DAY) - 2}
          y={yScale(0) - 7}
          fontSize={11}
          fontWeight="600"
          fill={theme.textSecondary}
          textAnchor="end">
          {`${Math.round(Math.exp(-MAX_DAY / 6) * 100)} %`}
        </SvgText>
      </FadeG>
      <FadeG progress={progress} at={0.94}>
        <SvgText
          x={xOf(MAX_DAY) - 2}
          y={yScale(endRetention) + 18}
          fontSize={13}
          fontWeight="800"
          fill={theme.tint}
          textAnchor="end">
          {`${Math.round(endRetention * 100)} %`}
        </SvgText>
      </FadeG>
    </Frame>
  );
}

/**
 * Slide 3: the testing effect (Roediger & Karpicke, 2006): two columns grow
 * from the baseline with a slight spring; values fade in above the caps.
 */
function GrowBar({
  progress,
  window: win,
  cx,
  value,
  color,
  opacity = 1,
}: {
  progress: SharedValue<number>;
  window: Window;
  cx: number;
  value: number;
  color: string;
  opacity?: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(progress.value, [win[0], win[1]], [0, 1], Extrapolation.CLAMP);
    const k = Easing.out(Easing.back(1.5))(t);
    const h = Math.max((yScale(0) - yScale(value)) * k, 0.001);
    const top = yScale(0) - h;
    const left = cx - BAR_W / 2;
    const r = Math.min(4, h);
    const d =
      `M${left},${yScale(0)} L${left},${top + r} Q${left},${top} ${left + r},${top} ` +
      `L${left + BAR_W - r},${top} Q${left + BAR_W},${top} ${left + BAR_W},${top + r} ` +
      `L${left + BAR_W},${yScale(0)} Z`;
    return { d };
  });
  return <AnimatedPath animatedProps={animatedProps} fill={color} opacity={opacity} />;
}

export function TestingEffectChart({
  active,
  width,
  rereadLabel,
  retrievalLabel,
}: {
  active: boolean;
  width: number;
  rereadLabel: string;
  retrievalLabel: string;
}) {
  const theme = useTheme();
  const progress = useChartProgress(active, 1800);
  const center = PAD.left + (width - PAD.left - PAD.right) / 2;
  const bars = [
    {
      cx: center - 57,
      value: 0.4,
      color: theme.textSecondary,
      opacity: 0.4,
      label: rereadLabel,
      window: [0.05, 0.42] as const,
    },
    {
      cx: center + 57,
      value: 0.61,
      color: theme.tint,
      opacity: 1,
      label: retrievalLabel,
      window: [0.38, 0.85] as const,
    },
  ];

  return (
    <Frame width={width}>
      {bars.map((bar) => (
        <G key={bar.label}>
          <GrowBar
            progress={progress}
            window={bar.window}
            cx={bar.cx}
            value={bar.value}
            color={bar.color}
            opacity={bar.opacity}
          />
          <FadeG progress={progress} at={bar.window[1]}>
            <SvgText
              x={bar.cx}
              y={yScale(bar.value) - 10}
              fontSize={13}
              fontWeight="600"
              fill={theme.text}
              textAnchor="middle">
              {Math.round(bar.value * 100)}%
            </SvgText>
          </FadeG>
          <SvgText x={bar.cx} y={H - 8} fontSize={10.5} fill={theme.textSecondary} textAnchor="middle">
            {bar.label}
          </SvgText>
        </G>
      ))}
    </Frame>
  );
}

/** Static legend row shown under a chart with two or more series. */
export function ChartLegend({
  items,
}: {
  items: { color: string; label: string; muted?: boolean }[];
}) {
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: item.color, opacity: item.muted ? 0.4 : 1 },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { alignItems: 'stretch', gap: Spacing.two },
  readout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  bigNumber: { fontSize: 44, lineHeight: 50, fontWeight: 800, minWidth: 120 },
  readoutSide: { flex: 1, paddingBottom: 6 },
  dayNumber: { fontSize: 17, lineHeight: 22, fontWeight: 700 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
