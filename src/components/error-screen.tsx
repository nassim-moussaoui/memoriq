import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown by Expo Router when a screen throws while rendering, instead of a
 * blank screen. Progress lives in SQLite and is never lost by a crash, and
 * the screen says so. Technical details stay folded away.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.icon, { backgroundColor: theme.warning + '22' }]}>
            <Ionicons name="construct-outline" size={34} color={theme.warning} />
          </View>
          <ThemedText style={styles.title}>{t('error.title')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {t('error.body')}
          </ThemedText>
          <Pressable onPress={() => setShowDetails((v) => !v)} hitSlop={8} style={styles.detailsToggle}>
            <ThemedText type="small" themeColor="textSecondary">
              {showDetails ? t('error.hideDetails') : t('error.showDetails')}
            </ThemedText>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
          </Pressable>
          {showDetails ? (
            <View style={[styles.details, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="code" themeColor="textSecondary" selectable>
                {error.message}
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('error.retry')} icon="refresh" onPress={() => void retry()} />
          <PrimaryButton
            label={t('error.home')}
            icon="home-outline"
            variant="soft"
            onPress={() => router.replace('/')}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { alignSelf: 'stretch', borderRadius: 14, padding: Spacing.three },
  footer: { gap: Spacing.two, paddingBottom: Spacing.three },
});
