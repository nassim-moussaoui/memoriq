import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import type { PurchasesStoreProduct } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buySadaqa, loadSadaqaProduct, purchasesAvailable } from '@/lib/purchases';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-auth';

type WaitStatus = 'none' | 'waiting' | 'granted';

function enter(index: number) {
  return FadeInDown.delay(index * 70).springify().damping(20);
}

/**
 * Sadaqa: one learner gifts a year of Premium, another who cannot afford it
 * receives it. Presented as a gift between users (App Store guideline 3.2.2:
 * never as a charitable donation). Gifts are assigned server-side by the
 * RevenueCat webhook to the longest-waiting student, anonymously both ways.
 */
export default function SadaqaScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const session = useSession();
  const isPremium = useAppStore((s) => s.isPremium);
  const [product, setProduct] = useState<PurchasesStoreProduct | null>(null);
  const [productState, setProductState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stats, setStats] = useState<{ waiting: number; gifted: number } | null>(null);
  const [wait, setWait] = useState<WaitStatus>('none');
  const [busy, setBusy] = useState<'buy' | 'wait' | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (purchasesAvailable()) {
      loadSadaqaProduct()
        .then((p) => {
          if (cancelled) return;
          setProduct(p);
          setProductState(p ? 'ready' : 'error');
        })
        .catch(() => !cancelled && setProductState('error'));
    } else {
      const timer = setTimeout(() => setProductState('error'), 0);
      return () => clearTimeout(timer);
    }
    supabase
      ?.rpc('sadaqa_stats')
      .single<{ waiting: number; gifted: number }>()
      .then(({ data }) => {
        if (!cancelled && data) setStats({ waiting: Number(data.waiting), gifted: Number(data.gifted) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from('sadaqa_waitlist')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle<{ status: string }>()
      .then(({ data }) => {
        if (!cancelled) setWait(data ? (data.status === 'granted' ? 'granted' : 'waiting') : 'none');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const gift = async () => {
    if (!product) return;
    setBusy('buy');
    try {
      if (await buySadaqa(product)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setThanks(true);
      }
    } catch (e) {
      Alert.alert(t('paywall.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const joinWaitlist = async () => {
    if (!supabase || !userId) return;
    setBusy('wait');
    const { error } = await supabase
      .from('sadaqa_waitlist')
      .insert({ user_id: userId, country: Localization.getLocales()[0]?.regionCode ?? null });
    setBusy(null);
    if (error) {
      Alert.alert(t('paywall.errorTitle'), error.message);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWait('waiting');
  };

  const leaveWaitlist = () =>
    Alert.alert(t('sadaqa.leaveTitle'), t('sadaqa.leaveBody'), [
      { text: t('auth.cancel'), style: 'cancel' },
      {
        text: t('sadaqa.leaveCta'),
        style: 'destructive',
        onPress: async () => {
          if (!supabase || !userId) return;
          setBusy('wait');
          await supabase.from('sadaqa_waitlist').delete().eq('user_id', userId);
          setBusy(null);
          setWait('none');
        },
      },
    ]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={[styles.heroIcon, { backgroundColor: theme.warning }]}>
            <Ionicons name="gift" size={32} color="#ffffff" />
          </Animated.View>
          <Animated.View entering={enter(1)} style={styles.heroText}>
            <ThemedText style={styles.title}>{t('sadaqa.title')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {t('sadaqa.subtitle')}
            </ThemedText>
          </Animated.View>

          {stats ? (
            <Animated.View entering={enter(2)} style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.statValue}>{stats.waiting}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {t('sadaqa.statWaiting', { count: stats.waiting })}
                </ThemedText>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={[styles.statValue, { color: theme.tint }]}>{stats.gifted}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {t('sadaqa.statGifted', { count: stats.gifted })}
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(3)} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHead}>
              <Ionicons name="heart" size={18} color={theme.warning} />
              <ThemedText style={styles.cardTitle}>{t('sadaqa.giveTitle')}</ThemedText>
            </View>
            {thanks ? (
              <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.thanks}>
                <Ionicons name="checkmark-circle" size={40} color={theme.tint} />
                <ThemedText style={styles.thanksTitle}>{t('sadaqa.thanksTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {t('sadaqa.thanksBody')}
                </ThemedText>
              </Animated.View>
            ) : (
              <>
                {[1, 2, 3].map((n) => (
                  <View key={n} style={styles.step}>
                    <View style={[styles.stepNum, { backgroundColor: theme.background }]}>
                      <ThemedText style={styles.stepNumText}>{n}</ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                      {t(`sadaqa.giveStep${n}`)}
                    </ThemedText>
                  </View>
                ))}
                {productState === 'loading' ? (
                  <ActivityIndicator color={theme.tint} />
                ) : productState === 'error' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('paywall.unavailable')}
                  </ThemedText>
                ) : (
                  <PrimaryButton
                    label={
                      busy === 'buy'
                        ? '...'
                        : t('sadaqa.giveCta', { price: product?.priceString ?? '' })
                    }
                    icon="gift-outline"
                    disabled={busy !== null}
                    onPress={() => void gift()}
                  />
                )}
              </>
            )}
          </Animated.View>

          {!isPremium ? (
            <Animated.View entering={enter(4)} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.cardHead}>
                <Ionicons name="school" size={18} color={theme.info} />
                <ThemedText style={styles.cardTitle}>{t('sadaqa.receiveTitle')}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {wait === 'waiting'
                  ? t('sadaqa.receiveWaiting')
                  : wait === 'granted'
                    ? t('sadaqa.receiveGranted')
                    : t('sadaqa.receiveBody')}
              </ThemedText>
              {!session ? (
                <PrimaryButton
                  label={t('sadaqa.needAccount')}
                  icon="person-outline"
                  variant="soft"
                  onPress={() => router.navigate('/profile')}
                />
              ) : wait === 'none' ? (
                <PrimaryButton
                  label={busy === 'wait' ? '...' : t('sadaqa.joinCta')}
                  icon="hand-left-outline"
                  variant="soft"
                  disabled={busy !== null}
                  onPress={() => void joinWaitlist()}
                />
              ) : wait === 'waiting' ? (
                <Pressable onPress={leaveWaitlist} hitSlop={8} style={styles.leave}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
                    {t('sadaqa.leaveCta')}
                  </ThemedText>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}

          <ThemedText style={[styles.fineprint, { color: theme.textSecondary }]}>
            {t('sadaqa.fineprint')}
          </ThemedText>
        </ScrollView>
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
  center: { textAlign: 'center' },
  topBar: { flexDirection: 'row', paddingVertical: Spacing.two },
  roundButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: Spacing.four, paddingBottom: Spacing.five },
  heroIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroText: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  stats: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', borderRadius: 18, paddingVertical: Spacing.three, gap: 2 },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: 500, textAlign: 'center' },
  card: { alignSelf: 'stretch', borderRadius: 22, padding: Spacing.four, gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: 800 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, lineHeight: 16, fontWeight: 800 },
  thanks: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  thanksTitle: { fontSize: 18, lineHeight: 24, fontWeight: 800, textAlign: 'center' },
  leave: { alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  fineprint: { fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 360 },
});
