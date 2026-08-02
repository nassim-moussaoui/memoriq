import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/themed-view';
import { countDue } from '@/lib/srs/db';
import { useAppStore, useStoreHydrated } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hydrated = useStoreHydrated();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);

  // Due-review badge on the Today tab: recount on every in-app navigation
  // (segments change) and when the app returns to the foreground.
  const segments = useSegments();
  const [foregroundTick, setForegroundTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);
  // segments/foregroundTick are intentional refresh triggers for the DB read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => countDue(), [segments, foregroundTick]);

  if (!hydrated) return <ThemedView style={{ flex: 1 }} />;
  if (!onboardingCompleted) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarBadge: due > 0 ? due : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.tint, color: '#ffffff' },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'today' : 'today-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
