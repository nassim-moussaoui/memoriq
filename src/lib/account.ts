import { Directory, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { cancelReminders, syncAppBadge } from "@/lib/notifications";
import { resetDatabase } from "@/lib/srs/db";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

/**
 * Data controls of the Profile: what each action erases is stated in the UI
 * before it runs. SQLite is the source of truth on the phone, Supabase the
 * copy in the cloud; account actions always handle both.
 */

function audioDir(): Directory | null {
  return Platform.OS === "web" ? null : new Directory(Paths.document, "audio");
}

/** Bytes used by the offline recitation cache. */
export function audioCacheSize(): number {
  try {
    const dir = audioDir();
    return dir && dir.exists ? (dir.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Frees the offline recitations; they download again when next played. */
export function clearAudioCache(): void {
  const dir = audioDir();
  if (dir && dir.exists) dir.delete();
}

/** Erases learning progress on this phone (settings and plan are kept). */
function wipeLocalProgress(): void {
  resetDatabase();
  useAppStore.setState({
    streak: 0,
    lastSessionDay: null,
    lastPushedLogId: 0,
    pendingDeletes: [],
  });
}

/**
 * Erases the learning progress, here and (when signed in) in the cloud,
 * keeping the account, the plan and the settings.
 */
export async function resetProgress(): Promise<void> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await supabase.rpc("delete_my_progress");
      if (error) throw error;
    }
  }
  wipeLocalProgress();
  await syncAppBadge().catch(() => {});
}

/**
 * Back to a fresh install: progress, plan, settings, reminders and the
 * audio cache. The app returns to the onboarding.
 */
export async function eraseThisPhone(): Promise<void> {
  resetDatabase();
  clearAudioCache();
  await cancelReminders().catch(() => {});
  useAppStore.setState(useAppStore.getInitialState(), true);
  await syncAppBadge().catch(() => {});
}

/**
 * Deletes the account and everything stored with it in the cloud (App Store
 * guideline 5.1.1(v)), then erases this phone too.
 */
export async function deleteAccount(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  // The session is now invalid server-side; only drop it locally.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  await eraseThisPhone();
}
