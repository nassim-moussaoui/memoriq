import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chapters, isFreeSurah, type Chapter } from '@/lib/quran';
import { getMemorizedCountBySurah, getStartedCountBySurah } from '@/lib/srs/db';
import { useAppStore } from '@/lib/store';

type Filter = 'all' | 'progress' | 'learned' | 'free';
const FILTERS: Filter[] = ['all', 'progress', 'learned', 'free'];

/** Lowercase, accents and apostrophes stripped: "Al-Fâtiha" ~ "al fatiha". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''`\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Arabic search ignores harakat and tatweel. */
function normalizeArabic(text: string): string {
  return text.replace(/[ً-ٰٟـ]/g, '');
}

function SurahRow({
  chapter,
  name,
  started,
  memorized,
  locked,
  active,
}: {
  chapter: Chapter;
  name: string;
  started: number;
  memorized: number;
  locked: boolean;
  active: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const learned = memorized >= chapter.versesCount;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (locked ? router.push('/paywall') : router.push(`/surah/${chapter.id}`))}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: active ? theme.tint : 'transparent',
        },
      ]}>
      <View
        style={[
          styles.number,
          { backgroundColor: learned ? theme.tint : active ? theme.tintSoft : theme.background },
        ]}>
        {learned ? (
          <Ionicons name="checkmark" size={18} color="#ffffff" />
        ) : (
          <ThemedText style={[styles.numberText, active && { color: theme.tint }]}>{chapter.id}</ThemedText>
        )}
      </View>
      <View style={styles.names}>
        <View style={styles.titleLine}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {chapter.nameSimple}
          </ThemedText>
          {active ? (
            <View style={[styles.tag, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.tagText}>{t('library.activeTag')}</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.sub}>
          {`${name} · ${t('library.verses', { count: chapter.versesCount })}`}
        </ThemedText>
        {started > 0 && !learned ? (
          <View style={styles.progressLine}>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: theme.tint + '55', width: `${(started / chapter.versesCount) * 100}%` },
                ]}
              />
              <View
                style={[
                  styles.fill,
                  styles.overlay,
                  { backgroundColor: theme.tint, width: `${(memorized / chapter.versesCount) * 100}%` },
                ]}
              />
            </View>
            <ThemedText style={[styles.progressText, { color: theme.tint }]}>
              {`${memorized}/${chapter.versesCount}`}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <ThemedText style={styles.arabicName}>{chapter.nameArabic}</ThemedText>
        {locked ? <Ionicons name="lock-closed" size={13} color={theme.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isPremium = useAppStore((s) => s.isPremium);
  const activeSurah = useAppStore((s) => s.activeSurah);
  const [memorized, setMemorized] = useState<Map<number, number>>(new Map());
  const [started, setStarted] = useState<Map<number, number>>(new Map());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      setMemorized(getMemorizedCountBySurah());
      setStarted(getStartedCountBySurah());
    }, []),
  );

  const isFr = i18n.language === 'fr';
  const q = normalize(query);
  const qArabic = normalizeArabic(query.trim());

  const visible = chapters.filter((c) => {
    const s = started.get(c.id) ?? 0;
    const m = memorized.get(c.id) ?? 0;
    if (filter === 'progress' && !(s > 0 && m < c.versesCount)) return false;
    if (filter === 'learned' && m < c.versesCount) return false;
    if (filter === 'free' && !isFreeSurah(c.id)) return false;
    if (!q) return true;
    return (
      String(c.id) === q ||
      normalize(c.nameSimple).includes(q) ||
      normalize(isFr ? c.nameFr : c.nameEn).includes(q) ||
      (qArabic.length > 0 && normalizeArabic(c.nameArabic).includes(qArabic))
    );
  });

  const inProgress = chapters.filter((c) => (started.get(c.id) ?? 0) > 0).length;

  const header = (
    <View style={styles.headerBlock}>
      <View>
        <ThemedText style={styles.title}>{t('library.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('library.subtitle', { count: inProgress })}
        </ThemedText>
      </View>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('library.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          style={[styles.searchInput, { color: theme.text }]}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('library.clearSearch')}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f)}
              style={[styles.chip, { backgroundColor: on ? theme.tint : theme.backgroundElement }]}>
              <ThemedText style={[styles.chipText, { color: on ? '#ffffff' : theme.text }]}>
                {t(`library.filter_${f}`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={visible}
          keyExtractor={(c) => String(c.id)}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <SurahRow
              chapter={item}
              name={isFr ? item.nameFr : item.nameEn}
              started={started.get(item.id) ?? 0}
              memorized={memorized.get(item.id) ?? 0}
              locked={!isFreeSurah(item.id) && !isPremium}
              active={item.id === activeSurah}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={28} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('library.empty')}
              </ThemedText>
            </View>
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  list: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  headerBlock: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, letterSpacing: -0.4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13.5, lineHeight: 18, fontWeight: 700 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.three,
  },
  number: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 14, lineHeight: 18, fontWeight: 800 },
  names: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: 16, lineHeight: 21, fontWeight: 700, flexShrink: 1 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  tagText: { color: '#ffffff', fontSize: 10.5, lineHeight: 14, fontWeight: 800 },
  sub: { fontWeight: 400 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 4 },
  track: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  overlay: { position: 'absolute', top: 0, left: 0 },
  progressText: { fontSize: 11.5, lineHeight: 15, fontWeight: 700 },
  trailing: { alignItems: 'flex-end', gap: 2 },
  arabicName: { fontSize: 22, lineHeight: 36, writingDirection: 'rtl' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyText: { textAlign: 'center' },
});

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';
