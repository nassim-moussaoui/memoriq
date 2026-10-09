import Ionicons from '@expo/vector-icons/Ionicons';
import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

/** Tokens Supabase puts in the URL fragment of a recovery link. */
function parseRecovery(url: string | null) {
  if (!url) return null;
  const hash = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const params = new URLSearchParams(hash);
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (params.get('error') || !access || !refresh) return { error: true as const };
  return { access, refresh };
}

/**
 * Landing screen of the "forgot password" email (memoriq://reset-password).
 * The link carries a short-lived recovery session; once it is restored the
 * learner picks a new password and is signed in.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const url = useLinkingURL();
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recovery = parseRecovery(url);
    if (!recovery || !supabase) {
      const timer = setTimeout(() => setStage((s) => (s === 'checking' ? 'invalid' : s)), 1500);
      return () => clearTimeout(timer);
    }
    if ('error' in recovery) {
      const timer = setTimeout(() => setStage('invalid'), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    supabase.auth
      .setSession({ access_token: recovery.access, refresh_token: recovery.refresh })
      .then(({ error: sessionError }) => {
        if (!cancelled) setStage(sessionError ? 'invalid' : 'ready');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const save = async () => {
    if (!supabase) return;
    if (password.length < 6) {
      setError(t('reset.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('reset.mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(t('auth.error', { message: updateError.message }));
    else setStage('done');
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={[styles.icon, { backgroundColor: theme.tintSoft }]}>
            <Ionicons
              name={stage === 'done' ? 'checkmark-done' : stage === 'invalid' ? 'link-outline' : 'key-outline'}
              size={30}
              color={theme.tint}
            />
          </View>
          <ThemedText style={styles.title}>
            {stage === 'done' ? t('reset.doneTitle') : stage === 'invalid' ? t('reset.invalidTitle') : t('reset.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {stage === 'done' ? t('reset.doneBody') : stage === 'invalid' ? t('reset.invalidBody') : t('reset.body')}
          </ThemedText>

          {stage === 'checking' ? <ActivityIndicator color={theme.tint} /> : null}

          {stage === 'ready' ? (
            <View style={styles.form}>
              <TextInput
                style={inputStyle}
                placeholder={t('reset.newPassword')}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
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
              {error ? (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {error}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {stage === 'ready' ? (
            <PrimaryButton
              label={busy ? '...' : t('reset.save')}
              icon="checkmark"
              disabled={busy || !password || !confirm}
              onPress={() => void save()}
            />
          ) : null}
          {stage === 'done' || stage === 'invalid' ? (
            <PrimaryButton
              label={stage === 'done' ? t('error.home') : t('reset.backToProfile')}
              icon={stage === 'done' ? 'home-outline' : 'person-outline'}
              onPress={() => router.replace(stage === 'done' ? '/' : '/profile')}
            />
          ) : null}
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
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  form: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.two },
  input: { borderRadius: 14, paddingHorizontal: Spacing.three, height: 50, fontSize: 16 },
  footer: { paddingBottom: Spacing.three },
});
