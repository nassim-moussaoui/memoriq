import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert } from 'react-native';

import { SettingsRow, SettingsSection } from '@/components/ui/settings';
import { useTheme } from '@/hooks/use-theme';
import {
  audioCacheSize,
  clearAudioCache,
  deleteAccount,
  eraseThisPhone,
  resetProgress,
} from '@/lib/account';
import { useSession } from '@/lib/use-auth';

function formatSize(bytes: number, t: TFunction): string {
  if (bytes < 1024 * 1024) return t('data.kb', { n: Math.max(0, Math.round(bytes / 1024)) });
  return t('data.mb', { n: (bytes / (1024 * 1024)).toFixed(1) });
}

/**
 * "My data" in the Profile: free the audio cache, reset progress, and either
 * erase the phone (no account) or delete the account (signed in). Every
 * destructive action says exactly what it erases before running; deleting
 * the account asks twice.
 */
export function DataSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const session = useSession();
  const [cacheBytes, setCacheBytes] = useState(() => audioCacheSize());
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>, after?: () => void) => {
    setBusy(key);
    try {
      await action();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      after?.();
    } catch (e) {
      Alert.alert(t('data.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, body: string, cta: string, onConfirm: () => void) =>
    Alert.alert(title, body, [
      { text: t('auth.cancel'), style: 'cancel' },
      { text: cta, style: 'destructive', onPress: onConfirm },
    ]);

  const onClearCache = () =>
    confirm(t('data.cacheTitle'), t('data.cacheBody'), t('data.cacheCta'), () => {
      clearAudioCache();
      setCacheBytes(audioCacheSize());
      void Haptics.selectionAsync();
    });

  const onResetProgress = () =>
    confirm(
      t('data.progressTitle'),
      session ? t('data.progressBodyCloud') : t('data.progressBodyLocal'),
      t('data.progressCta'),
      () => void run('progress', resetProgress, () => router.replace('/')),
    );

  const onEraseAll = () =>
    confirm(t('data.eraseTitle'), t('data.eraseBody'), t('data.eraseCta'), () =>
      void run('erase', eraseThisPhone, () => router.replace('/onboarding')),
    );

  const onDeleteAccount = () =>
    confirm(t('data.deleteTitle'), t('data.deleteBody'), t('data.deleteCta'), () =>
      // Irreversible: a second, explicit confirmation.
      confirm(t('data.deleteConfirmTitle'), t('data.deleteConfirmBody'), t('data.deleteConfirmCta'), () =>
        void run('delete', deleteAccount, () => router.replace('/onboarding')),
      ),
    );

  const spinner = (key: string) =>
    busy === key ? <ActivityIndicator size="small" color={theme.textSecondary} /> : undefined;

  return (
    <SettingsSection title={t('data.section')} footer={t('data.footer')}>
      <SettingsRow
        icon="musical-notes"
        iconColor={theme.info}
        label={t('data.cache')}
        value={formatSize(cacheBytes, t)}
        onPress={cacheBytes > 0 ? onClearCache : undefined}
        chevron={false}
      />
      <SettingsRow
        icon="refresh"
        iconColor={theme.warning}
        label={t('data.progress')}
        detail={session ? t('data.progressDetailCloud') : t('data.progressDetailLocal')}
        onPress={busy ? undefined : onResetProgress}
        right={spinner('progress')}
        destructive
      />
      {session ? (
        <SettingsRow
          icon="person-remove"
          iconColor={theme.danger}
          label={t('data.delete')}
          detail={t('data.deleteDetail')}
          onPress={busy ? undefined : onDeleteAccount}
          right={spinner('delete')}
          destructive
        />
      ) : (
        <SettingsRow
          icon="trash"
          iconColor={theme.danger}
          label={t('data.erase')}
          detail={t('data.eraseDetail')}
          onPress={busy ? undefined : onEraseAll}
          right={spinner('erase')}
          destructive
        />
      )}
    </SettingsSection>
  );
}
