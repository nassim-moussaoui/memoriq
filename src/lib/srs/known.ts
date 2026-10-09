import { getChapter } from "@/lib/quran";

import { getStartedAyahs, saveItem } from "./db";
import { newCard, rate, Rating } from "./scheduler";

const DAY = 24 * 60 * 60 * 1000;
const FIRST_CHECK_MIN_DAYS = 7;
const FIRST_CHECK_MAX_DAYS = 45;

/** Verses of these surahs not started yet (what marking them would add). */
export function countUnstartedVerses(surahIds: number[]): number {
  return surahIds.reduce(
    (n, id) => n + getChapter(id).versesCount - getStartedAyahs(id).size,
    0
  );
}

/**
 * Marks surahs the learner already knows by heart (learned elsewhere): every
 * verse not started yet enters review directly, as if recited perfectly once,
 * with no learning step. Nothing is written to the review log, so the daily
 * new-verse cap and the stats of real sessions stay untouched.
 *
 * The first check is spread between 7 and 45 days, one date per surah: a
 * whole surah comes back together (recited in sequence), and marking many
 * surahs at once never floods a single day. Returns the verses added.
 */
export function markSurahsKnown(surahIds: number[], now: number = Date.now()): number {
  const ordered = [...new Set(surahIds)].sort((a, b) => a - b);
  const span = FIRST_CHECK_MAX_DAYS - FIRST_CHECK_MIN_DAYS;
  let added = 0;
  ordered.forEach((surahId, i) => {
    const offsetDays =
      ordered.length === 1
        ? FIRST_CHECK_MIN_DAYS
        : FIRST_CHECK_MIN_DAYS + Math.round((i * span) / (ordered.length - 1));
    const due = now + offsetDays * DAY;
    const started = getStartedAyahs(surahId);
    const { versesCount } = getChapter(surahId);
    for (let ayah = 1; ayah <= versesCount; ayah++) {
      if (started.has(ayah)) continue;
      const card = rate(newCard(new Date(now)), Rating.Easy, new Date(now));
      // Same day for the whole surah; one second apart keeps mushaf order.
      saveItem(surahId, ayah, { ...card, due: new Date(due + ayah * 1000) });
      added += 1;
    }
  });
  return added;
}
