import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getTotals, type Totals } from '@/lib/srs/db';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const streak = useAppStore((s) => s.streak);
  const [totals, setTotals] = useState<Totals | null>(null);

  useFocusEffect(
    useCallback(() => {
      setTotals(getTotals());
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('stats.title')}
        </ThemedText>
        <View style={styles.grid}>
          <StatTile label={t('stats.memorized')} value={totals?.memorizedVerses ?? 0} />
          <StatTile label={t('stats.started')} value={totals?.startedVerses ?? 0} />
          <StatTile label={t('stats.reviews')} value={totals?.totalReviews ?? 0} />
          <StatTile label={t('stats.today')} value={totals?.reviewsToday ?? 0} />
          <StatTile label={t('stats.streak')} value={streak} />
        </View>
        <View style={styles.scienceRow}>
          <Ionicons name="school-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('stats.science')}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  title: { paddingVertical: Spacing.two },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tileValue: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  scienceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.one,
  },
});
