import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';
import { useSession } from '@/lib/use-auth';
import { useTheme } from '@/hooks/use-theme';

/** Email sign-in / sign-up plus manual sync. Hidden when Supabase is not configured. */
export function AccountSection() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const session = useSession();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!supabase) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {t('profile.account')}
      </ThemedText>
    );
  }
  const client = supabase;

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(t('auth.error', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const result = await syncNow();
      return result
        ? t('auth.syncDone', { items: result.pushedItems, logs: result.pushedLogs })
        : null;
    });

  const signUp = () =>
    run(async () => {
      const { error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      return t('auth.confirmEmail');
    });

  const signOut = () =>
    run(async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return null;
    });

  const sync = () =>
    run(async () => {
      const result = await syncNow();
      return result
        ? t('auth.syncDone', { items: result.pushedItems, logs: result.pushedLogs })
        : null;
    });

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.background, color: theme.text },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <View style={styles.headerRow}>
        <Ionicons name="cloud-outline" size={18} color={theme.tint} />
        <ThemedText type="default">{t('auth.title')}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('auth.subtitle')}
      </ThemedText>

      {session ? (
        <>
          <ThemedText type="small">{session.user.email}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {lastSyncAt
              ? t('auth.syncedAt', {
                  time: new Date(lastSyncAt).toLocaleString(i18n.language),
                })
              : t('auth.syncNever')}
          </ThemedText>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, { backgroundColor: theme.tint }]}
              disabled={busy}
              onPress={sync}>
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {t('auth.sync')}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
              disabled={busy}
              onPress={signOut}>
              <ThemedText type="smallBold">{t('auth.signOut')}</ThemedText>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <TextInput
            style={inputStyle}
            placeholder={t('auth.email')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('auth.password')}
            placeholderTextColor={theme.textSecondary}
            autoComplete="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, { backgroundColor: theme.tint }]}
              disabled={busy || !email || !password}
              onPress={signIn}>
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {t('auth.signIn')}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
              disabled={busy || !email || !password}
              onPress={signUp}>
              <ThemedText type="smallBold">{t('auth.signUp')}</ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {message && (
        <ThemedText type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#ffffff' },
  note: { textAlign: 'center' },
});
