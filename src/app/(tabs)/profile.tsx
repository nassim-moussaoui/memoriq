import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '@/components/account-section';
import { DataSection } from '@/components/data-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsRow, SettingsSection, Stepper } from '@/components/ui/settings';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RECITERS, getReciter } from '@/lib/audio';
import {
  addMinutesToTime,
  cancelReminders,
  DEFAULT_REMINDER_TIMES,
  requestReminderPermission,
  scheduleDailyReminder,
} from '@/lib/notifications';
import { useAppStore } from '@/lib/store';

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
/** "In the name of Allah, the Most Merciful, the Most Compassionate". */
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

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
    void Haptics.selectionAsync();
    store.setReciterId(id);
    setReciterListOpen(false);
  };

  const reminderTime = store.reminderTime ?? DEFAULT_REMINDER_TIMES[store.reviewMoment];

  const toggleReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestReminderPermission();
      if (!granted) {
        Alert.alert(t('notif.permissionTitle'), t('notif.permissionBody'));
        return;
      }
      store.setReminderTime(reminderTime);
      store.setRemindersEnabled(true);
      await scheduleDailyReminder(reminderTime);
    } else {
      store.setRemindersEnabled(false);
      await cancelReminders();
    }
  };

  const shiftReminderTime = async (deltaMinutes: number) => {
    void Haptics.selectionAsync();
    const next = addMinutesToTime(reminderTime, deltaMinutes);
    store.setReminderTime(next);
    if (store.remindersEnabled) await scheduleDailyReminder(next);
  };

  const fontScale = Math.round(store.arabicFontScale * 10) / 10;
  const setFont = (next: number) => {
    void Haptics.selectionAsync();
    store.setArabicFontScale(Math.round(Math.min(Math.max(next, FONT_MIN), FONT_MAX) * 10) / 10);
  };

  const switchProps = { trackColor: { true: theme.tint, false: theme.backgroundSelected } };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <ThemedText style={styles.title}>{t('profile.title')}</ThemedText>

          <AccountSection />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/paywall')}
            style={({ pressed }) => [
              styles.premium,
              { backgroundColor: theme.tint, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <View style={styles.premiumIcon}>
              <Ionicons name="star" size={20} color="#ffffff" />
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.premiumTitle}>{t('profile.premiumTitle')}</ThemedText>
              <ThemedText style={styles.premiumSub}>{t('profile.premiumSubtitle')}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ffffff" />
          </Pressable>

          <SettingsSection title={t('profile.sectionLearning')}>
            <SettingsRow
              icon="flag"
              iconColor={theme.tint}
              label={t('profile.plan')}
              value={t('profile.planValue', { count: store.minutesPerDay })}
              onPress={() => router.push('/onboarding')}
            />
            <SettingsRow
              icon="mic"
              iconColor={theme.info}
              label={t('profile.reciter')}
              value={reciter.name}
              onPress={() => setReciterListOpen((open) => !open)}
              chevron={false}
              right={
                <Ionicons
                  name={reciterListOpen ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={theme.textSecondary}
                />
              }
            />
            {reciterListOpen
              ? RECITERS.map((r) => {
                  const selected = r.id === reciter.id;
                  const locked = r.premium && !store.isPremium;
                  return (
                    <SettingsRow
                      key={r.id}
                      label={r.name}
                      detail={r.id === 'husary_muallim' ? t('profile.reciterTeaching') : undefined}
                      onPress={() => pickReciter(r.id, r.premium)}
                      chevron={false}
                      right={
                        locked ? (
                          <View style={[styles.lockPill, { backgroundColor: theme.tintSoft }]}>
                            <Ionicons name="lock-closed" size={11} color={theme.tint} />
                            <ThemedText style={[styles.lockText, { color: theme.tint }]}>
                              {t('library.premium')}
                            </ThemedText>
                          </View>
                        ) : selected ? (
                          <Ionicons name="checkmark" size={20} color={theme.tint} />
                        ) : null
                      }
                    />
                  );
                })
              : null}
          </SettingsSection>

          <SettingsSection title={t('profile.sectionDisplay')}>
            <SettingsRow
              icon="language"
              iconColor={theme.warning}
              label={t('profile.translation')}
              right={
                <Switch value={store.showTranslation} onValueChange={store.setShowTranslation} {...switchProps} />
              }
            />
            <SettingsRow
              icon="text"
              iconColor={theme.info}
              label={t('profile.transliteration')}
              detail={t('profile.transliterationDetail')}
              right={
                <Switch
                  value={store.showTransliteration}
                  onValueChange={store.setShowTransliteration}
                  {...switchProps}
                />
              }
            />
            <SettingsRow
              icon="resize"
              iconColor={theme.tint}
              label={t('profile.arabicSize')}
              right={
                <Stepper
                  value={`${Math.round(fontScale * 100)} %`}
                  onDecrement={() => setFont(fontScale - FONT_STEP)}
                  onIncrement={() => setFont(fontScale + FONT_STEP)}
                  decrementLabel={t('a11y.smaller')}
                  incrementLabel={t('a11y.bigger')}
                  canDecrement={fontScale > FONT_MIN + 0.01}
                  canIncrement={fontScale < FONT_MAX - 0.01}
                />
              }
            />
            <View style={styles.preview}>
              <Text
                style={[
                  styles.previewText,
                  { color: theme.text, fontSize: 26 * fontScale, lineHeight: 26 * fontScale * 1.8 },
                ]}>
                {BASMALA}
              </Text>
            </View>
          </SettingsSection>

          <SettingsSection
            title={t('profile.sectionReminders')}
            footer={store.remindersEnabled ? t('profile.remindersFooter') : undefined}>
            <SettingsRow
              icon="notifications"
              iconColor={theme.danger}
              label={t('profile.reminders')}
              right={
                <Switch
                  value={store.remindersEnabled}
                  onValueChange={(v) => void toggleReminders(v)}
                  {...switchProps}
                />
              }
            />
            {store.remindersEnabled ? (
              <SettingsRow
                icon="time"
                iconColor={theme.textSecondary}
                label={t('profile.reminderTime')}
                right={
                  <Stepper
                    value={reminderTime}
                    onDecrement={() => void shiftReminderTime(-30)}
                    onIncrement={() => void shiftReminderTime(30)}
                    decrementLabel={t('a11y.earlier')}
                    incrementLabel={t('a11y.later')}
                  />
                }
              />
            ) : null}
          </SettingsSection>

          <DataSection />

          <SettingsSection title={t('profile.sectionAbout')}>
            <SettingsRow
              icon="school"
              iconColor={theme.info}
              label={t('profile.method')}
              onPress={() => router.push('/onboarding')}
            />
            <SettingsRow
              icon="information-circle"
              iconColor={theme.textSecondary}
              label={t('profile.version')}
              value={Constants.expoConfig?.version ?? '1.0.0'}
            />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, letterSpacing: -0.4, marginBottom: -Spacing.two },
  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    padding: Spacing.three,
  },
  premiumIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTitle: { color: '#ffffff', fontSize: 16, lineHeight: 21, fontWeight: 800 },
  premiumSub: { color: '#ffffffd9', fontSize: 12.5, lineHeight: 17 },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  lockText: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
  preview: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  previewText: { textAlign: 'center', writingDirection: 'rtl' },
});

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';
