import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chapters } from '@/lib/quran';
import {
  getDailyReviewCounts,
  getDueForecast,
  getMemorizedCountBySurah,
  getSuccessRate,
  getTotals,
  type Totals,
} from '@/lib/srs/db';
import { useAppStore } from '@/lib/store';

type IconName = ComponentProps<typeof Ionicons>['name'];

const WEEKS = 13;
const CELL_GAP = 3;
const PAD = Spacing.three;
const CARD_PAD = Spacing.four;

function enter(index: number) {
  return FadeInDown.delay(index * 70).springify().damping(20);
}

function dayKey(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
    day.getDate(),
  ).padStart(2, '0')}`;
}

type Cell = { key: string; date: Date; count: number; future: boolean };

/** 13 weeks of days, Monday-first columns, ending with the current week. */
function buildHeatmap(counts: Map<string, number>): Cell[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - mondayOffset - (WEEKS - 1) * 7);
  const columns: Cell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const column: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(date);
      column.push({ key, date, count: counts.get(key) ?? 0, future: date > today });
    }
    columns.push(column);
  }
  return columns;
}

/** Sequential steps of the accent: one hue, light to dark, by review count. */
function level(count: number): number {
  if (count === 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}
const LEVEL_ALPHA = ['', '40', '73', 'B3', 'FF'];

function Tile({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.tileIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
      <ThemedText style={[styles.tileLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const streak = useAppStore((s) => s.streak);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [heatmap, setHeatmap] = useState<Cell[][]>([]);
  const [forecast, setForecast] = useState<number[]>([]);
  const [success, setSuccess] = useState<number | null>(null);
  const [surahsDone, setSurahsDone] = useState(0);
  const [pickedDay, setPickedDay] = useState<Cell | null>(null);
  const [pickedBar, setPickedBar] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTotals(getTotals());
      setHeatmap(buildHeatmap(getDailyReviewCounts(WEEKS * 7 + 7)));
      setForecast(getDueForecast(7));
      setSuccess(getSuccessRate(30));
      const memorized = getMemorizedCountBySurah();
      setSurahsDone(chapters.filter((c) => (memorized.get(c.id) ?? 0) >= c.versesCount).length);
      setPickedDay(null);
      setPickedBar(0);
    }, []),
  );

  const innerWidth = Math.min(width, MaxContentWidth) - PAD * 2 - CARD_PAD * 2;
  const cell = Math.floor((innerWidth - CELL_GAP * (WEEKS - 1)) / WEEKS);
  const activeDays = heatmap.flat().filter((c) => c.count > 0).length;
  const maxForecast = Math.max(1, ...forecast);
  const BAR_AREA = 110;

  const dayLabel = (offset: number) => {
    if (offset === 0) return t('stats.todayShort');
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString(i18n.language, { weekday: 'short' }).replace('.', '');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)}>
            <ThemedText style={styles.title}>{t('stats.title')}</ThemedText>
          </Animated.View>

          <Animated.View entering={enter(1)} style={[styles.hero, { backgroundColor: theme.tint }]}>
            <ThemedText style={styles.heroLabel}>{t('stats.memorized').toUpperCase()}</ThemedText>
            <ThemedText style={styles.heroValue}>{totals?.memorizedVerses ?? 0}</ThemedText>
            <ThemedText style={styles.heroSub}>
              {t('stats.heroSub', { started: totals?.startedVerses ?? 0, count: surahsDone })}
            </ThemedText>
          </Animated.View>

          <Animated.View entering={enter(2)} style={styles.tiles}>
            <Tile icon="flame" color={theme.warning} value={`${streak}`} label={t('stats.streak', { count: streak })} />
            <Tile
              icon="checkmark-circle"
              color={theme.tint}
              value={success === null ? '-' : `${Math.round(success * 100)} %`}
              label={t('stats.success')}
            />
            <Tile icon="today" color={theme.info} value={`${totals?.reviewsToday ?? 0}`} label={t('stats.today')} />
            <Tile icon="layers" color={theme.textSecondary} value={`${totals?.totalReviews ?? 0}`} label={t('stats.reviews')} />
          </Animated.View>

          <Animated.View entering={enter(3)} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t('stats.activityTitle')}</ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                {t('stats.activeDays', { count: activeDays })}
              </ThemedText>
            </View>
            <View style={styles.heatmap}>
              {heatmap.map((column, w) => (
                <View key={w} style={styles.heatColumn}>
                  {column.map((c) => {
                    const lv = level(c.count);
                    const picked = pickedDay?.key === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        disabled={c.future}
                        onPress={() => setPickedDay(picked ? null : c)}
                        accessibilityLabel={`${c.date.toLocaleDateString(i18n.language)}: ${t('stats.reviewsCount', { count: c.count })}`}
                        hitSlop={1}
                        style={[
                          styles.heatCell,
                          {
                            width: cell,
                            height: cell,
                            backgroundColor: c.future
                              ? 'transparent'
                              : lv === 0
                                ? theme.backgroundSelected
                                : theme.tint + LEVEL_ALPHA[lv],
                            borderColor: picked ? theme.text : 'transparent',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.heatFooter}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {pickedDay
                  ? `${pickedDay.date.toLocaleDateString(i18n.language, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })} : ${t('stats.reviewsCount', { count: pickedDay.count })}`
                  : t('stats.activityHint')}
              </ThemedText>
              <View style={styles.legend}>
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
                  {t('stats.less')}
                </ThemedText>
                {[0, 1, 2, 3, 4].map((lv) => (
                  <View
                    key={lv}
                    style={[
                      styles.legendCell,
                      { backgroundColor: lv === 0 ? theme.backgroundSelected : theme.tint + LEVEL_ALPHA[lv] },
                    ]}
                  />
                ))}
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
                  {t('stats.more')}
                </ThemedText>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={enter(4)} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t('stats.forecastTitle')}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {`${pickedBar === 0 ? t('stats.todayLong') : dayLabel(pickedBar)} : ${t('stats.reviewsCount', {
                count: forecast[pickedBar] ?? 0,
              })}`}
            </ThemedText>
            <View style={[styles.bars, { height: BAR_AREA + 22 }]}>
              {forecast.map((n, i) => {
                const picked = i === pickedBar;
                const h = n === 0 ? 3 : Math.max(8, (n / maxForecast) * BAR_AREA);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setPickedBar(i)}
                    accessibilityLabel={`${dayLabel(i)}: ${t('stats.reviewsCount', { count: n })}`}
                    style={styles.barSlot}>
                    <View style={[styles.barTrack, { height: BAR_AREA }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor: picked ? theme.tint : theme.tint + '73',
                          },
                        ]}
                      />
                    </View>
                    <ThemedText
                      style={[
                        styles.barLabel,
                        { color: picked ? theme.text : theme.textSecondary, fontWeight: picked ? 800 : 600 },
                      ]}>
                      {dayLabel(i)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View entering={enter(5)} style={[styles.science, { borderColor: theme.backgroundSelected }]}>
            <Ionicons name="school-outline" size={18} color={theme.tint} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('stats.science')}
            </ThemedText>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  content: { padding: PAD, paddingBottom: Spacing.five, gap: Spacing.three },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, letterSpacing: -0.4 },
  hero: { borderRadius: 28, padding: Spacing.four, gap: 2 },
  heroLabel: { color: '#ffffffcc', fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1 },
  heroValue: { color: '#ffffff', fontSize: 56, lineHeight: 64, fontWeight: 800 },
  heroSub: { color: '#ffffffe6', fontSize: 14, lineHeight: 19, fontWeight: 500 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { flexBasis: '48%', flexGrow: 1, borderRadius: 20, padding: Spacing.three, gap: 4 },
  tileIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 26, lineHeight: 32, fontWeight: 800, marginTop: 4 },
  tileLabel: { fontSize: 12.5, lineHeight: 16, fontWeight: 500 },
  card: { borderRadius: 24, padding: CARD_PAD, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: 800 },
  heatmap: { flexDirection: 'row', gap: CELL_GAP },
  heatColumn: { gap: CELL_GAP },
  heatCell: { borderRadius: 4, borderWidth: 1.5 },
  heatFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendCell: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10.5, lineHeight: 14, marginHorizontal: 2 },
  bars: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  barSlot: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 11, lineHeight: 14, textTransform: 'capitalize' },
  science: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
  },
});
