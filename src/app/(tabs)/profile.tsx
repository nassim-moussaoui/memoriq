import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '@/components/account-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { RECITERS, getReciter } from '@/lib/audio';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useAppStore();
  const reciter = getReciter(store.reciterId);
  const [reciterListOpen, setReciterListOpen] = useState(false);

  const pickReciter = (id: string, premium: boolean) => {
    if (premium && !store.isPremium) {
      router.push('/paywall');
      return;
    }
    store.setReciterId(id);
    setReciterListOpen(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
        <ThemedText type="subtitle" style={styles.title}>
          {t('profile.title')}
        </ThemedText>

        <Pressable onPress={() => router.push('/paywall')}>
          <ThemedView style={[styles.premiumCard, { backgroundColor: theme.tintSoft }]}>
            <Ionicons name="star" size={22} color={theme.tint} />
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ color: theme.tint }}>
                {t('profile.premiumTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('profile.premiumSubtitle')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.tint} />
          </ThemedView>
        </Pressable>

        <ThemedView type="backgroundElement" style={styles.section}>
          <Pressable style={styles.row} onPress={() => setReciterListOpen((open) => !open)}>
            <ThemedText type="default" style={{ flex: 1 }}>
              {t('profile.reciter')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {reciter.name}
            </ThemedText>
            <Ionicons
              name={reciterListOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          </Pressable>
          {reciterListOpen &&
            RECITERS.map((r) => {
              const selected = r.id === reciter.id;
              const locked = r.premium && !store.isPremium;
              return (
                <Pressable
                  key={r.id}
                  style={styles.reciterOption}
                  onPress={() => pickReciter(r.id, r.premium)}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? theme.tint : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={[{ flex: 1 }, selected ? { color: theme.tint } : undefined]}>
                    {r.name}
                  </ThemedText>
                  {locked && (
                    <View style={[styles.premiumPill, { backgroundColor: theme.tintSoft }]}>
                      <Ionicons name="lock-closed" size={11} color={theme.tint} />
                      <ThemedText style={[styles.premiumPillText, { color: theme.tint }]}>
                        {t('library.premium')}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          <View style={styles.row}>
            <ThemedText type="default" style={{ flex: 1 }}>
              {t('profile.translation')}
            </ThemedText>
            <Switch
              value={store.showTranslation}
              onValueChange={store.setShowTranslation}
              trackColor={{ true: theme.tint }}
            />
          </View>
          <View style={styles.row}>
            <ThemedText type="default" style={{ flex: 1 }}>
              {t('profile.transliteration')}
            </ThemedText>
            <Switch
              value={store.showTransliteration}
              onValueChange={store.setShowTransliteration}
              trackColor={{ true: theme.tint }}
            />
          </View>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <Pressable style={styles.row} onPress={() => router.push('/onboarding')}>
            <Ionicons name="school-outline" size={18} color={theme.text} />
            <ThemedText type="default" style={{ flex: 1 }}>
              {t('profile.method')}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        </ThemedView>

        <AccountSection />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  title: { paddingTop: Spacing.two },
  reciterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingStart: Spacing.two,
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  premiumPillText: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  section: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
});
