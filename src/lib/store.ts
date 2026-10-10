import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localDay } from "@/lib/dates";

import { DEFAULT_RECITER_ID } from "@/lib/audio";

export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "juzamma" | "prayer" | "hifz";
export type ReviewMoment = "morning" | "afterPrayer" | "evening";

/**
 * Where each goal starts. Juz' 'Amma works backwards from the shortest surah
 * (An-Nas), prayer starts with the one most recited in salat (Al-Ikhlas), and
 * full hifz follows the structured order from the top of Juz' 'Amma.
 */
const JUZ_AMMA_DESC = Array.from({ length: 37 }, (_, i) => 114 - i); // 114 down to 78

/** Learning order per goal: where a learner with that goal naturally starts. */
function surahOrderForGoal(goal: Goal): number[] {
  switch (goal) {
    case "prayer":
      // The short surahs most recited in salat first.
      return [112, 113, 114, ...JUZ_AMMA_DESC.filter((id) => id < 112), 1];
    case "hifz":
      return [...JUZ_AMMA_DESC].reverse().concat(1);
    default:
      return [...JUZ_AMMA_DESC, 1];
  }
}

/**
 * The first surah to learn for a goal, skipping surahs the learner already
 * knows (ticked during the onboarding). Falls back to the goal's usual start.
 */
export function startingSurahForGoal(goal: Goal, known: ReadonlySet<number> = new Set()): number {
  const order = surahOrderForGoal(goal);
  return order.find((id) => !known.has(id)) ?? order[0];
}

type AppState = {
  onboardingCompleted: boolean;
  level: Level;
  /** Why the user memorizes (chosen during onboarding). */
  goal: Goal;
  /** Preferred moment of the day for reviewing (anchor of the daily reminder). */
  reviewMoment: ReviewMoment;
  /** Daily reminder notification. `reminderTime` is "HH:MM" (24h). */
  remindersEnabled: boolean;
  reminderTime: string | null;
  minutesPerDay: 5 | 10 | 20;
  /** Surah currently being learned (the "sabaq" source). */
  activeSurah: number;

  reciterId: string;
  /** Recitation speed; slowing down is a classic hifz technique. */
  playbackRate: 0.75 | 1 | 1.25;
  showTranslation: boolean;
  showTransliteration: boolean;
  arabicFontScale: number;

  /** Mirror of the RevenueCat "premium" entitlement (see lib/purchases). */
  isPremium: boolean;

  streak: number;
  /** Local date (YYYY-MM-DD) of the last completed session. */
  lastSessionDay: string | null;

  /**
   * Verses removed locally ("no longer known") that must also be deleted
   * on the server, otherwise the next pull would bring them back. Kept here
   * so an offline removal is applied at the next sync.
   */
  pendingDeletes: { surah: number; ayah: number }[];

  /** Highest local review_logs id already pushed to Supabase. */
  lastPushedLogId: number;
  lastSyncAt: number | null;

  completeOnboarding: (opts: {
    minutesPerDay: 5 | 10 | 20;
    goal: Goal;
    reviewMoment: ReviewMoment;
    /** Surahs ticked as already known, skipped when picking the first one. */
    known?: number[];
  }) => void;
  setActiveSurah: (surah: number) => void;
  setRemindersEnabled: (v: boolean) => void;
  setReminderTime: (time: string) => void;
  setReciterId: (id: string) => void;
  setPlaybackRate: (rate: 0.75 | 1 | 1.25) => void;
  setShowTranslation: (v: boolean) => void;
  setShowTransliteration: (v: boolean) => void;
  setArabicFontScale: (v: number) => void;
  setPremium: (v: boolean) => void;
  registerSessionDone: () => void;
  markSynced: (lastPushedLogId: number) => void;
  addPendingDeletes: (items: { surah: number; ayah: number }[]) => void;
  clearPendingDeletes: (count: number) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingCompleted: false,
      level: "beginner",
      goal: "juzamma",
      reviewMoment: "evening",
      remindersEnabled: false,
      reminderTime: null,
      minutesPerDay: 10,
      activeSurah: 114,

      reciterId: DEFAULT_RECITER_ID,
      playbackRate: 1,
      showTranslation: true,
      showTransliteration: false,
      arabicFontScale: 1,

      isPremium: false,

      streak: 0,
      lastSessionDay: null,

      pendingDeletes: [],
      lastPushedLogId: 0,
      lastSyncAt: null,

      completeOnboarding: ({ minutesPerDay, goal, reviewMoment, known = [] }) =>
        set((state) => ({
          onboardingCompleted: true,
          minutesPerDay,
          goal,
          reviewMoment,
          // The goal only aims the very first surah; revisiting the plan later
          // never moves the user off the surah they are working on.
          activeSurah: state.onboardingCompleted
            ? state.activeSurah
            : startingSurahForGoal(goal, new Set(known)),
        })),
      setActiveSurah: (activeSurah) => set({ activeSurah }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setReminderTime: (reminderTime) => set({ reminderTime }),
      setReciterId: (reciterId) => set({ reciterId }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setShowTransliteration: (showTransliteration) => set({ showTransliteration }),
      setArabicFontScale: (arabicFontScale) => set({ arabicFontScale }),
      setPremium: (isPremium) => set({ isPremium }),

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

      markSynced: (lastPushedLogId) => set({ lastPushedLogId, lastSyncAt: Date.now() }),
      addPendingDeletes: (items) => set({ pendingDeletes: [...get().pendingDeletes, ...items] }),
      // Drops the first `count` entries (the ones a sync just applied).
      clearPendingDeletes: (count) => set({ pendingDeletes: get().pendingDeletes.slice(count) }),
    }),
    {
      name: "memoriq-app",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 added goal/reviewMoment/reminders; missing keys fall back to the
      // defaults above, so migration is a pass-through.
      version: 1,
      migrate: (persisted) => persisted as AppState,
    }
  )
);

/** AsyncStorage rehydration is async: gate navigation decisions on this. */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false
  );
}
