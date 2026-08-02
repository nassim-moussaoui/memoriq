import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Placeholder paywall. Phase 5 replaces the disabled buttons with RevenueCat
 * Paywalls (react-native-purchases-ui) and wires the Sadaqa gifting flow.
 */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const features = [t('paywall.feature1'), t('paywall.feature2'), t('paywall.feature3')];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.close')}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Ionicons name="star" size={44} color={theme.tint} />
          <ThemedText type="subtitle" style={styles.center}>
            {t('paywall.title')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('paywall.subtitle')}
          </ThemedText>

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
                <ThemedText type="default" style={{ flex: 1 }}>
                  {f}
                </ThemedText>
              </View>
            ))}
          </View>

          <ThemedView
            style={[
              styles.comingSoon,
              { backgroundColor: theme.tintSoft, borderColor: theme.tint },
            ]}>
            <Ionicons name="hourglass-outline" size={20} color={theme.tint} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                {t('paywall.comingSoonTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('paywall.comingSoonBody')}
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sadaqa}>
            <View style={styles.sadaqaHeader}>
              <Ionicons name="heart" size={20} color={theme.danger} />
              <ThemedText type="default">{t('paywall.sadaqaTitle')}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {t('paywall.sadaqaBody')}
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: Spacing.two },
  content: { alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.four },
  center: { textAlign: 'center' },
  features: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.two },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  comingSoon: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    padding: Spacing.three,
  },
  sadaqa: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sadaqaHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
