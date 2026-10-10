import { getChapter } from "@/lib/quran";
import { useAppStore } from "@/lib/store";

import { deleteItem, getAllItems, getStartedAyahs, saveItem } from "./db";
import { newCard, rate, Rating, type Card } from "./scheduler";

/**
 * A card created by "I already know this surah". The flag travels with the
 * card JSON (SQLite and Supabase): such verses count as learned but are never
 * scheduled (db.ts filters them out of every review query). The scheduler
 * drops the flag on any rating (a fresh card is returned), and "remove from
 * what I know" deletes the cards so the surah can be learned anew.
 */
type KnownCard = Card & { known?: true };

/** Verses of these surahs not started yet (what marking them would add). */
export function countUnstartedVerses(surahIds: number[]): number {
  return surahIds.reduce(
    (n, id) => n + getChapter(id).versesCount - getStartedAyahs(id).size,
    0
  );
}

/**
 * Marks surahs the learner already knows by heart (learned elsewhere): every
 * verse not started yet is recorded as learned, as if recited perfectly once,
 * without being scheduled for review. A learner who feels one fading removes
 * it from what they know and learns it again. Nothing is written to the
 * review log, so the daily new-verse cap and session stats stay untouched.
 * Returns the verses added.
 */
export function markSurahsKnown(surahIds: number[], now: number = Date.now()): number {
  let added = 0;
  for (const surahId of new Set(surahIds)) {
    const started = getStartedAyahs(surahId);
    const { versesCount } = getChapter(surahId);
    for (let ayah = 1; ayah <= versesCount; ayah++) {
      if (started.has(ayah)) continue;
      const card = rate(newCard(new Date(now)), Rating.Easy, new Date(now));
      const known: KnownCard = { ...card, known: true };
      saveItem(surahId, ayah, known);
      added += 1;
    }
  }
  return added;
}

/** Ayahs of a surah still only declared known (never reviewed since). */
export function getKnownAyahs(surahId: number): number[] {
  return getAllItems()
    .filter((item) => item.surah === surahId && (item.card as KnownCard).known)
    .map((item) => item.ayah);
}

/**
 * Undoes "I already know this surah" for the verses that were never reviewed
 * since: they go back to "not started", locally and (at the next sync) on the
 * account. Verses already verified in a review are kept. Returns the count.
 */
export function unmarkSurahKnown(surahId: number): number {
  const ayahs = getKnownAyahs(surahId);
  for (const ayah of ayahs) deleteItem(surahId, ayah);
  useAppStore.getState().addPendingDeletes(ayahs.map((ayah) => ({ surah: surahId, ayah })));
  return ayahs.length;
}
