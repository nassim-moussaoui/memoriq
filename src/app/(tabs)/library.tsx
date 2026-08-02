import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { chapters, isFreeSurah, type Chapter } from '@/lib/quran';
import { getMemorizedCountBySurah } from '@/lib/srs/db';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

export default function LibraryScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isPremium = useAppStore((s) => s.isPremium);
  const [memorized, setMemorized] = useState<Map<number, number>>(new Map());

  useFocusEffect(
    useCallback(() => {
      setMemorized(getMemorizedCountBySurah());
    }, [])
  );

  const renderItem = ({ item }: { item: Chapter }) => {
    const locked = !isFreeSurah(item.id) && !isPremium;
    const done = memorized.get(item.id) ?? 0;
    const name = i18n.language === 'fr' ? item.nameFr : item.nameEn;

    return (
      <Pressable
        onPress={() => (locked ? router.push('/paywall') : router.push(`/surah/${item.id}`))}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <View style={[styles.number, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{item.id}</ThemedText>
          </View>
          <View style={styles.names}>
            <ThemedText type="default">{item.nameSimple}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {name} · {t('library.verses', { count: item.versesCount })}
            </ThemedText>
            {done > 0 && (
              <ThemedText type="small" style={{ color: theme.tint }}>
                {t('library.memorized', { done, total: item.versesCount })}
              </ThemedText>
            )}
          </View>
          <ThemedText style={styles.arabicName}>{item.nameArabic}</ThemedText>
          {locked && <Ionicons name="lock-closed" size={16} color={theme.textSecondary} />}
        </ThemedView>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('library.title')}
        </ThemedText>
        <FlatList
          data={chapters}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three },
  title: { paddingVertical: Spacing.two },
  list: { gap: Spacing.two, paddingBottom: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  number: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flex: 1, gap: 2 },
  arabicName: { fontSize: 22, lineHeight: 34 },
});
