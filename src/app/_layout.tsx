import '@/lib/i18n';

import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/splash-overlay';
import { syncAppBadge } from '@/lib/notifications';
import { syncNow } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();

// Reminders should still banner if the app happens to be open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Recitation must be audible even with the iOS mute switch on, keep going
    // when the screen locks (listening on the go), and own the lock screen.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
    // Pull/push progress on launch when signed in; silent no-op otherwise.
    syncNow().catch(() => {});
    syncAppBadge().catch(() => {});

    // Tapping the daily reminder lands directly in the session.
    const tap = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.url === '/session') {
        router.push('/session');
      }
    });
    const appState = AppState.addEventListener('change', () => {
      syncAppBadge().catch(() => {});
    });
    return () => {
      tap.remove();
      appState.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="surah/[id]" />
        <Stack.Screen name="session" options={{ gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account-edit" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

// A render error shows a recovery screen instead of a blank one.
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';
