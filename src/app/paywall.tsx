import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { websiteUrl } from '@/constants/links';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  buyPackage,
  loadPackages,
  manageSubscription,
  purchasesAvailable,
  restorePurchases,
  type PaywallPackages,
} from '@/lib/purchases';
import { useAppStore } from '@/lib/store';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Plan = 'annual' | 'monthly';
type Load = { state: 'loading' } | { state: 'ready'; packages: PaywallPackages } | { state: 'error' };

function enter(index: number) {
  return FadeInDown.delay(index * 70).springify().damping(20);
}

function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function hasFreeTrial(pkg: PurchasesPackage | null): boolean {
  return pkg?.product.introPrice?.price === 0;
}

function PlanCard({
  selected,
  title,
  price,
  detail,
  badge,
  onPress,
}: {
  selected: boolean;
  title: string;
  price: string;
  detail?: string;
  badge?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.plan,
        {
          backgroundColor: selected ? theme.tintSoft : theme.backgroundElement,
          borderColor: selected ? theme.tint : 'transparent',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      {badge ? (
        <View style={[styles.planBadge, { backgroundColor: theme.tint }]}>
          <ThemedText style={styles.planBadgeText}>{badge}</ThemedText>
        </View>
      ) : null}
      <View style={[styles.radio, { borderColor: selected ? theme.tint : theme.backgroundSelected }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: theme.tint }]} /> : null}
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.planTitle}>{title}</ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.planDetail}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText style={[styles.planPrice, selected && { color: theme.tint }]}>{price}</ThemedText>
    </Pressable>
  );
}

/**
 * The real paywall: RevenueCat offering (annual first, with its free trial),
 * restore and manage (both required by Apple), legal links, and the way into
 * the Sadaqa gift. Premium learners see their status instead.
 */
export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isPremium = useAppStore((s) => s.isPremium);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [plan, setPlan] = useState<Plan>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!purchasesAvailable()) {
      const timer = setTimeout(() => setLoad({ state: 'error' }), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    loadPackages()
      .then((packages) => {
        if (cancelled) return;
        setLoad(packages.annual || packages.monthly ? { state: 'ready', packages } : { state: 'error' });
        if (!packages.annual && packages.monthly) setPlan('monthly');
      })
      .catch(() => !cancelled && setLoad({ state: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const packages = load.state === 'ready' ? load.packages : null;
  const selected = packages ? (plan === 'annual' ? packages.annual : packages.monthly) : null;
  const trial = plan === 'annual' && hasFreeTrial(packages?.annual ?? null);

  const annual = packages?.annual?.product;
  const monthly = packages?.monthly?.product;
  const savings =
    annual && monthly && monthly.price > 0
      ? Math.round((1 - annual.price / (monthly.price * 12)) * 100)
      : null;

  const buy = async () => {
    if (!selected) return;
    setBusy('buy');
    try {
      if (await buyPackage(selected)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('paywall.welcomeTitle'), t('paywall.welcomeBody'), [
          { text: t('paywall.welcomeCta'), onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      Alert.alert(t('paywall.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const restored = await restorePurchases();
      Alert.alert(
        restored ? t('paywall.restoredTitle') : t('paywall.nothingTitle'),
        restored ? t('paywall.restoredBody') : t('paywall.nothingBody'),
      );
    } catch (e) {
      Alert.alert(t('paywall.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const features: { icon: IconName; key: string }[] = [
    { icon: 'book', key: 'feature1' },
    { icon: 'mic', key: 'feature2' },
    { icon: 'cloud-offline', key: 'feature3' },
    { icon: 'gift', key: 'feature4' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.close')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={[styles.heroIcon, { backgroundColor: theme.tint }]}>
            <Ionicons name="star" size={32} color="#ffffff" />
          </Animated.View>
          <Animated.View entering={enter(1)} style={styles.heroText}>
            <ThemedText style={styles.title}>
              {isPremium ? t('paywall.premiumTitle') : t('paywall.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {isPremium ? t('paywall.premiumBody') : t('paywall.subtitle')}
            </ThemedText>
          </Animated.View>

          <Animated.View entering={enter(2)} style={styles.features}>
            {features.map((f) => (
              <View key={f.key} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: theme.tintSoft }]}>
                  <Ionicons name={f.icon} size={16} color={theme.tint} />
                </View>
                <ThemedText style={styles.featureText}>{t(`paywall.${f.key}`)}</ThemedText>
              </View>
            ))}
          </Animated.View>

          {isPremium ? null : load.state === 'loading' ? (
            <ActivityIndicator color={theme.tint} style={styles.loader} />
          ) : load.state === 'error' ? (
            <Animated.View entering={enter(3)} style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {t('paywall.unavailable')}
              </ThemedText>
              <Pressable onPress={() => setAttempt((n) => n + 1)} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  {t('error.retry')}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={enter(3)} style={styles.plans}>
              {packages?.annual ? (
                <PlanCard
                  selected={plan === 'annual'}
                  title={t('paywall.annual')}
                  price={packages.annual.product.priceString}
                  detail={t('paywall.perMonth', {
                    price: formatMoney(packages.annual.product.price / 12, packages.annual.product.currencyCode, i18n.language),
                  })}
                  badge={
                    hasFreeTrial(packages.annual)
                      ? t('paywall.trialBadge')
                      : savings && savings > 0
                        ? t('paywall.saveBadge', { percent: savings })
                        : undefined
                  }
                  onPress={() => setPlan('annual')}
                />
              ) : null}
              {packages?.monthly ? (
                <PlanCard
                  selected={plan === 'monthly'}
                  title={t('paywall.monthly')}
                  price={packages.monthly.product.priceString}
                  detail={t('paywall.cancelAnytime')}
                  onPress={() => setPlan('monthly')}
                />
              ) : null}
            </Animated.View>
          )}

          <Animated.View entering={enter(4)} style={styles.flexStretch}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sadaqa')}
              style={({ pressed }) => [
                styles.sadaqa,
                { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}>
              <View style={[styles.featureIcon, styles.sadaqaIcon, { backgroundColor: theme.warning + '22' }]}>
                <Ionicons name="gift" size={18} color={theme.warning} />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.planTitle}>{t('paywall.sadaqaTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.planDetail}>
                  {t('paywall.sadaqaBody')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {isPremium ? (
            <PrimaryButton
              label={t('paywall.manage')}
              icon="settings-outline"
              onPress={() => void manageSubscription().catch(() => {})}
            />
          ) : (
            <>
              <PrimaryButton
                label={busy === 'buy' ? '...' : trial ? t('paywall.ctaTrial') : t('paywall.cta')}
                icon={trial ? 'gift-outline' : 'star'}
                disabled={!selected || busy !== null}
                onPress={() => void buy()}
              />
              {selected ? (
                <ThemedText style={[styles.fineprint, { color: theme.textSecondary }]}>
                  {trial
                    ? t('paywall.trialTerms', { price: selected.product.priceString })
                    : plan === 'annual'
                      ? t('paywall.annualTerms', { price: selected.product.priceString })
                      : t('paywall.monthlyTerms', { price: selected.product.priceString })}
                </ThemedText>
              ) : null}
            </>
          )}
          <View style={styles.links}>
            <Pressable onPress={() => void restore()} disabled={busy !== null} hitSlop={6}>
              <ThemedText style={[styles.link, { color: theme.textSecondary }]}>
                {busy === 'restore' ? '...' : t('paywall.restore')}
              </ThemedText>
            </Pressable>
            <ThemedText style={[styles.link, { color: theme.textSecondary }]}>·</ThemedText>
            <Pressable onPress={() => void Linking.openURL(websiteUrl('terms', i18n.language))} hitSlop={6}>
              <ThemedText style={[styles.link, { color: theme.textSecondary }]}>{t('paywall.terms')}</ThemedText>
            </Pressable>
            <ThemedText style={[styles.link, { color: theme.textSecondary }]}>·</ThemedText>
            <Pressable onPress={() => void Linking.openURL(websiteUrl('privacy', i18n.language))} hitSlop={6}>
              <ThemedText style={[styles.link, { color: theme.textSecondary }]}>{t('paywall.privacy')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  flex: { flex: 1 },
  flexStretch: { alignSelf: 'stretch' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: Spacing.two },
  roundButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: Spacing.four, paddingBottom: Spacing.four },
  heroIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroText: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  features: { alignSelf: 'stretch', gap: Spacing.three },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  featureIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 15.5, lineHeight: 21, fontWeight: 600 },
  loader: { marginVertical: Spacing.four },
  notice: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 18,
    padding: Spacing.three,
  },
  plans: { alignSelf: 'stretch', gap: Spacing.three },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: 2,
    padding: Spacing.three,
    paddingVertical: Spacing.three + 2,
  },
  planBadge: {
    position: 'absolute',
    top: -11,
    right: Spacing.three,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: { color: '#ffffff', fontSize: 11.5, lineHeight: 15, fontWeight: 800 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  planTitle: { fontSize: 16, lineHeight: 21, fontWeight: 700 },
  planDetail: { fontWeight: 400, lineHeight: 18 },
  planPrice: { fontSize: 17, lineHeight: 22, fontWeight: 800 },
  sadaqa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    padding: Spacing.three,
  },
  sadaqaIcon: { width: 38, height: 38, borderRadius: 19 },
  footer: { gap: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  fineprint: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
  link: { fontSize: 12.5, lineHeight: 17, fontWeight: 600 },
});
