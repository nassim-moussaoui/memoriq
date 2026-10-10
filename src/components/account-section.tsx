import Ionicons from '@expo/vector-icons/Ionicons';
import { createURL } from 'expo-linking';

import { websiteUrl } from '@/constants/links';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
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
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

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
      const text = await action();
      setMessage(text ? { kind: 'info', text } : null);
    } catch (e) {
      setMessage({
        kind: 'error',
        text: t('auth.error', { message: e instanceof Error ? e.message : String(e) }),
      });
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
      const { error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: websiteUrl('confirmed', i18n.language) },
      });
      if (error) throw error;
      return t('auth.confirmEmail');
    });

  const forgotPassword = () => {
    if (!email.trim()) {
      setMessage({ kind: 'error', text: t('auth.resetNeedsEmail') });
      return;
    }
    void run(async () => {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: createURL('/reset-password'),
      });
      if (error) throw error;
      return t('auth.resetSent');
    });
  };

  const signOut = () =>
    run(async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return null;
    });

  const confirmSignOut = () => {
    Alert.alert(t('auth.signOutConfirmTitle'), t('auth.signOutConfirmBody'), [
      { text: t('auth.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

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

  const feedback = message ? (
    <View style={styles.messageRow}>
      <Ionicons
        name={message.kind === 'error' ? 'alert-circle' : 'checkmark-circle'}
        size={16}
        color={message.kind === 'error' ? theme.danger : theme.tint}
      />
      <ThemedText
        type="small"
        style={[styles.flex, { color: message.kind === 'error' ? theme.danger : theme.textSecondary }]}>
        {message.text}
      </ThemedText>
    </View>
  ) : null;

  if (session) {
    const email = session.user.email ?? '';
    return (
      <View style={styles.wrap}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.avatarText}>{(email[0] ?? '?').toUpperCase()}</ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.email} numberOfLines={1}>
                {email}
              </ThemedText>
              <View style={styles.syncLine}>
                <View style={[styles.syncDot, { backgroundColor: lastSyncAt ? theme.tint : theme.warning }]} />
                <ThemedText style={[styles.syncText, { color: theme.textSecondary }]}>
                  {lastSyncAt
                    ? t('auth.syncedAt', { time: new Date(lastSyncAt).toLocaleString(i18n.language) })
                    : t('auth.syncNever')}
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/account-edit', params: { field: 'email' } })}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="mail-outline" size={18} color={theme.text} />
            <ThemedText style={[styles.actionText, styles.flex]}>{t('auth.changeEmail')}</ThemedText>
            <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
          </Pressable>
          <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/account-edit', params: { field: 'password' } })}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="key-outline" size={18} color={theme.text} />
            <ThemedText style={[styles.actionText, styles.flex]}>{t('auth.changePassword')}</ThemedText>
            <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
          </Pressable>
          <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={sync}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.backgroundSelected }]}>
            {busy ? (
              <ActivityIndicator color={theme.tint} size="small" />
            ) : (
              <Ionicons name="sync" size={18} color={theme.tint} />
            )}
            <ThemedText style={[styles.actionText, { color: theme.tint }]}>{t('auth.sync')}</ThemedText>
          </Pressable>
          <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            <ThemedText style={[styles.actionText, { color: theme.danger }]}>{t('auth.signOut')}</ThemedText>
          </Pressable>
        </View>
        {feedback}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.signInCard, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.identity, styles.identityFlat]}>
        <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
          <Ionicons name="cloud-outline" size={22} color={theme.tint} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.email}>{t('auth.title')}</ThemedText>
          <ThemedText style={[styles.syncText, { color: theme.textSecondary }]}>{t('auth.subtitle')}</ThemedText>
        </View>
      </View>
      <TextInput
        style={inputStyle}
        placeholder={t('auth.email')}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder={t('auth.password')}
        placeholderTextColor={theme.textSecondary}
        autoComplete="password"
        textContentType="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.buttons}>
        <PrimaryButton
          label={busy ? '...' : t('auth.signIn')}
          icon={null}
          disabled={busy || !email || !password}
          onPress={() => void signIn()}
        />
        <PrimaryButton
          label={t('auth.signUp')}
          icon={null}
          variant="soft"
          disabled={busy || !email || !password}
          onPress={() => void signUp()}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={forgotPassword}
        hitSlop={8}
        style={styles.forgot}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.forgotText}>
          {t('auth.forgot')}
        </ThemedText>
      </Pressable>
      {feedback}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  flex: { flex: 1 },
  card: { borderRadius: 22, overflow: 'hidden' },
  signInCard: { padding: Spacing.three, gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  identityFlat: { padding: 0 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 20, lineHeight: 26, fontWeight: 800 },
  email: { fontSize: 16, lineHeight: 21, fontWeight: 700 },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: 12.5, lineHeight: 17 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
  actionText: { fontSize: 16, lineHeight: 21, fontWeight: 600 },
  input: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 16,
  },
  buttons: { gap: Spacing.two },
  forgot: { alignSelf: 'center', paddingVertical: Spacing.one },
  forgotText: { textDecorationLine: 'underline' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one, paddingHorizontal: Spacing.one },
  note: { textAlign: 'center' },
});
