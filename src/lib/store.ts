import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_RECITER_ID } from "@/lib/audio";

export type Level = "beginner" | "intermediate" | "advanced";

type AppState = {
  onboardingCompleted: boolean;
  level: Level;
  minutesPerDay: 5 | 10 | 20;
  /** Surah currently being learned (the "sabaq" source). */
  activeSurah: number;

  reciterId: string;
  showTranslation: boolean;
  showTransliteration: boolean;
  arabicFontScale: number;

  /** Premium entitlement — wired to RevenueCat in a later phase. */
  isPremium: boolean;

  streak: number;
  /** Local date (YYYY-MM-DD) of the last completed session. */
  lastSessionDay: string | null;

  completeOnboarding: (opts: { level: Level; minutesPerDay: 5 | 10 | 20; activeSurah: number }) => void;
  setActiveSurah: (surah: number) => void;
  setReciterId: (id: string) => void;
  setShowTranslation: (v: boolean) => void;
  setShowTransliteration: (v: boolean) => void;
  setArabicFontScale: (v: number) => void;
  registerSessionDone: () => void;
};

function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingCompleted: false,
      level: "beginner",
      minutesPerDay: 10,
      activeSurah: 114,

      reciterId: DEFAULT_RECITER_ID,
      showTranslation: true,
      showTransliteration: false,
      arabicFontScale: 1,

      isPremium: false,

      streak: 0,
      lastSessionDay: null,

      completeOnboarding: ({ level, minutesPerDay, activeSurah }) =>
        set({ onboardingCompleted: true, level, minutesPerDay, activeSurah }),
      setActiveSurah: (activeSurah) => set({ activeSurah }),
      setReciterId: (reciterId) => set({ reciterId }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowTransliteration: (showTransliteration) => set({ showTransliteration }),
      setArabicFontScale: (arabicFontScale) => set({ arabicFontScale }),

      registerSessionDone: () => {
        const today = localDay();
        const { lastSessionDay, streak } = get();
        if (lastSessionDay === today) return;
        const yesterday = localDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
        set({
          lastSessionDay: today,
          streak: lastSessionDay === yesterday ? streak + 1 : 1,
        });
      },
    }),
    {
      name: "memoriq-app",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** AsyncStorage rehydration is async — gate navigation decisions on this. */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false
  );
}
