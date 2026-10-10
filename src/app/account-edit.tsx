import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { websiteUrl } from '@/constants/links';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/use-auth';

type Field = 'email' | 'password';

/**
 * Change the account email or password (opened from the Profile). An email
 * change is confirmed by Supabase through a link sent to the new address.
 */
export default function AccountEditScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const session = useSession();
  const { field: rawField } = useLocalSearchParams<{ field?: string }>();
  const field: Field = rawField === 'password' ? 'password' : 'email';

  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async () => {
    if (!supabase) return;
    setError(null);
    if (field === 'password') {
      if (value.length < 6) return setError(t('reset.tooShort'));
      if (value !== confirm) return setError(t('reset.mismatch'));
    } else if (!/^\S+@\S+\.\S+$/.test(value.trim())) {
      return setError(t('accountEdit.invalidEmail'));
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser(
      field === 'password' ? { password: value } : { email: value.trim() },
      { emailRedirectTo: websiteUrl('confirmed', i18n.language) },
    );
    setBusy(false);
    if (updateError) {
      setError(t('auth.error', { message: updateError.message }));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={[styles.icon, { backgroundColor: theme.tintSoft }]}>
            <Ionicons
              name={done ? 'checkmark-done' : field === 'email' ? 'mail-outline' : 'key-outline'}
              size={28}
              color={theme.tint}
            />
          </View>
          <ThemedText style={styles.title}>
            {done
              ? field === 'email'
                ? t('accountEdit.emailSentTitle')
                : t('reset.doneTitle')
              : field === 'email'
                ? t('accountEdit.emailTitle')
                : t('accountEdit.passwordTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {done
              ? field === 'email'
                ? t('accountEdit.emailSentBody', { email: value.trim() })
                : t('accountEdit.passwordDoneBody')
              : field === 'email'
                ? t('accountEdit.emailBody', { email: session?.user.email ?? '' })
                : t('reset.body')}
          </ThemedText>

          {!done ? (
            <View style={styles.form}>
              {field === 'email' ? (
                <TextInput
                  style={inputStyle}
                  placeholder={t('accountEdit.newEmail')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  value={value}
                  onChangeText={setValue}
                  autoFocus
                />
              ) : (
                <>
                  <TextInput
                    style={inputStyle}
                    placeholder={t('reset.newPassword')}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    value={value}
                    onChangeText={setValue}
                    autoFocus
                  />
                  <TextInput
                    style={inputStyle}
                    placeholder={t('reset.confirmPassword')}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    value={confirm}
                    onChangeText={setConfirm}
                  />
                </>
              )}
              {error ? (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {error}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {done ? (
            <PrimaryButton label={t('accountEdit.close')} icon="checkmark" onPress={() => router.back()} />
          ) : (
            <PrimaryButton
              label={busy ? '...' : t('reset.save')}
              icon="checkmark"
              disabled={busy || !value || (field === 'password' && !confirm)}
              onPress={() => void save()}
            />
          )}
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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: Spacing.two },
  roundButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.five },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  form: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.two },
  input: { borderRadius: 14, paddingHorizontal: Spacing.three, height: 50, fontSize: 16 },
  footer: { paddingBottom: Spacing.three },
});
