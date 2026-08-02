import { getAllItems, getLogsAfter, mergeRemoteItem } from "@/lib/srs/db";
import { reviveCard, type SerializedCard } from "@/lib/srs/scheduler";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export type SyncResult = {
  pushedItems: number;
  pushedLogs: number;
  pulledItems: number;
};

/**
 * Two-way sync between device SQLite (source of truth) and Supabase.
 *  - pull: merge remote cards in (more reps wins — see mergeRemoteItem)
 *  - push: upsert every local item (idempotent), append new review logs
 *    (deduplicated server-side by (user_id, client_id))
 * No-op when Supabase is unconfigured or the user is signed out.
 */
export async function syncNow(): Promise<SyncResult | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: remoteItems, error: pullError } = await supabase
    .from("memorization_items")
    .select("surah, ayah, card");
  if (pullError) throw pullError;

  let pulledItems = 0;
  for (const row of remoteItems ?? []) {
    if (mergeRemoteItem(row.surah, row.ayah, reviveCard(row.card as SerializedCard))) {
      pulledItems += 1;
    }
  }

  const items = getAllItems();
  if (items.length > 0) {
    const { error } = await supabase.from("memorization_items").upsert(
      items.map((i) => ({
        user_id: user.id,
        surah: i.surah,
        ayah: i.ayah,
        card: i.card,
        due_at: new Date(i.dueAt).toISOString(),
        state: i.state,
      }))
    );
    if (error) throw error;
  }

  const { lastPushedLogId } = useAppStore.getState();
  const logs = getLogsAfter(lastPushedLogId);
  if (logs.length > 0) {
    const { error } = await supabase.from("review_logs").upsert(
      logs.map((l) => ({
        user_id: user.id,
        surah: l.surah,
        ayah: l.ayah,
        rating: l.rating,
        reviewed_at: new Date(l.reviewedAt).toISOString(),
        client_id: l.id,
      })),
      { onConflict: "user_id,client_id", ignoreDuplicates: true }
    );
    if (error) throw error;
  }

  const state = useAppStore.getState();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      level: state.level,
      minutes_per_day: state.minutesPerDay,
      active_surah: state.activeSurah,
      streak: state.streak,
      last_session_day: state.lastSessionDay,
    })
    .eq("id", user.id);
  if (profileError) throw profileError;

  state.markSynced(logs.length > 0 ? logs[logs.length - 1].id : lastPushedLogId);

  return { pushedItems: items.length, pushedLogs: logs.length, pulledItems };
}
