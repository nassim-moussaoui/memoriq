import '@/lib/i18n';

import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
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
    // Recitation must be audible even with the iOS mute switch on.
    setAudioModeAsync({ playsInSilentMode: true });
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
      </Stack>
    </ThemeProvider>
  );
}
