import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
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

  const cycleReciter = () => {
    const index = RECITERS.findIndex((r) => r.id === reciter.id);
    const next = RECITERS[(index + 1) % RECITERS.length];
    if (next.premium && !store.isPremium) {
      router.push('/paywall');
      return;
    }
    store.setReciterId(next.id);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          <Pressable style={styles.row} onPress={cycleReciter}>
            <ThemedText type="default" style={{ flex: 1 }}>
              {t('profile.reciter')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {reciter.name}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
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
    gap: Spacing.three,
  },
  title: { paddingTop: Spacing.two },
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
