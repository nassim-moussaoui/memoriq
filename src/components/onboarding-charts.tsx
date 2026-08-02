import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * Educational illustrations for the onboarding. Design rules: one accent hue
 * (theme.tint) + neutral gray for the comparison series, 2px lines, direct
 * labels instead of legends, recessive grid, text in text colors.
 */
const W = 300;
const H = 160;
const PAD = { top: 16, right: 12, bottom: 24, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function x(day: number, maxDay: number): number {
  return PAD.left + (day / maxDay) * PLOT_W;
}

function y(retention: number): number {
  return PAD.top + (1 - retention) * PLOT_H;
}

function decayPath(maxDay: number, stability: number, from = 0, initial = 1): string {
  const points: string[] = [];
  for (let d = from; d <= maxDay; d += maxDay / 60) {
    const r = initial * Math.exp(-(d - from) / stability);
    points.push(`${points.length === 0 ? 'M' : 'L'}${x(d, maxDay).toFixed(1)},${y(r).toFixed(1)}`);
  }
  return points.join(' ');
}

function Frame({ children, yLabel }: { children: React.ReactNode; yLabel: string }) {
  const theme = useTheme();
  return (
    <Svg width={W} height={H}>
      {/* recessive grid: two horizontal lines at 50% and 100% */}
      {[0.5, 1].map((r) => (
        <Line
          key={r}
          x1={PAD.left}
          y1={y(r)}
          x2={W - PAD.right}
          y2={y(r)}
          stroke={theme.backgroundSelected}
          strokeWidth={1}
        />
      ))}
      <SvgText x={PAD.left - 6} y={y(1) + 4} fontSize={10} fill={theme.textSecondary} textAnchor="end">
        100%
      </SvgText>
      <SvgText x={PAD.left - 6} y={y(0.5) + 4} fontSize={10} fill={theme.textSecondary} textAnchor="end">
        50%
      </SvgText>
      <SvgText x={W - PAD.right} y={H - 6} fontSize={10} fill={theme.textSecondary} textAnchor="end">
        {yLabel}
      </SvgText>
      {children}
    </Svg>
  );
}

/** Slide 1: the Ebbinghaus forgetting curve — a single decaying series. */
export function ForgettingCurveChart({ daysLabel }: { daysLabel: string }) {
  const theme = useTheme();
  return (
    <View>
      <Frame yLabel={daysLabel}>
        <Path d={decayPath(30, 6)} stroke={theme.tint} strokeWidth={2} fill="none" />
      </Frame>
    </View>
  );
}

/**
 * Slide 2: the same decay, but each review (dot) resets retention to 100% and
 * slows the next decay — the curve flattens. The gray reference series shows
 * what happens without reviews.
 */
export function SpacedRepetitionChart({
  daysLabel,
  withLabel,
  withoutLabel,
}: {
  daysLabel: string;
  withLabel: string;
  withoutLabel: string;
}) {
  const theme = useTheme();
  const maxDay = 30;
  const reviews = [
    { day: 0, stability: 6 },
    { day: 3, stability: 12 },
    { day: 10, stability: 30 },
    { day: 22, stability: 80 },
  ];
  const segments = reviews.map((r, i) => {
    const end = reviews[i + 1]?.day ?? maxDay;
    const points: string[] = [];
    for (let d = r.day; d <= end; d += 0.5) {
      const ret = Math.exp(-(d - r.day) / r.stability);
      points.push(`${points.length === 0 ? 'M' : 'L'}${x(d, maxDay).toFixed(1)},${y(ret).toFixed(1)}`);
    }
    return points.join(' ');
  });

  return (
    <View>
      <Frame yLabel={daysLabel}>
        <Path d={decayPath(maxDay, 6)} stroke={theme.textSecondary} strokeWidth={2} fill="none" opacity={0.45} />
        {segments.map((d, i) => (
          <Path key={i} d={d} stroke={theme.tint} strokeWidth={2} fill="none" />
        ))}
        {reviews.slice(1).map((r) => (
          <Circle key={r.day} cx={x(r.day, maxDay)} cy={y(1)} r={4} fill={theme.tint} />
        ))}
        {/* direct labels, no legend */}
        <SvgText x={x(20, maxDay)} y={y(0.92) - 6} fontSize={10} fill={theme.tint} textAnchor="middle">
          {withLabel}
        </SvgText>
        <SvgText x={x(16, maxDay)} y={y(0.04)} fontSize={10} fill={theme.textSecondary} textAnchor="middle">
          {withoutLabel}
        </SvgText>
      </Frame>
    </View>
  );
}

/**
 * Slide 3: the testing effect (Roediger & Karpicke, 2006) — retention after a
 * week, restudying vs. retrieval practice. Two bars, direct value labels.
 */
export function TestingEffectChart({
  rereadLabel,
  retrievalLabel,
}: {
  rereadLabel: string;
  retrievalLabel: string;
}) {
  const theme = useTheme();
  const bars = [
    { label: rereadLabel, value: 0.4, color: theme.textSecondary, opacity: 0.45 },
    { label: retrievalLabel, value: 0.61, color: theme.tint, opacity: 1 },
  ];
  const barWidth = 64;
  const gap = 48;
  const startX = PAD.left + (PLOT_W - (barWidth * 2 + gap)) / 2;

  return (
    <View>
      <Svg width={W} height={H}>
        <Line
          x1={PAD.left}
          y1={y(0)}
          x2={W - PAD.right}
          y2={y(0)}
          stroke={theme.backgroundSelected}
          strokeWidth={1}
        />
        {bars.map((bar, i) => {
          const bx = startX + i * (barWidth + gap);
          const by = y(bar.value);
          return (
            <G key={bar.label}>
              <Rect
                x={bx}
                y={by}
                width={barWidth}
                height={y(0) - by}
                rx={4}
                fill={bar.color}
                opacity={bar.opacity}
              />
              <SvgText x={bx + barWidth / 2} y={by - 8} fontSize={12} fontWeight="bold" fill={theme.text} textAnchor="middle">
                {Math.round(bar.value * 100)}%
              </SvgText>
              <SvgText x={bx + barWidth / 2} y={H - 6} fontSize={10} fill={theme.textSecondary} textAnchor="middle">
                {bar.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
