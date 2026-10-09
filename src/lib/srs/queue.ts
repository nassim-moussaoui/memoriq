import { getChapter } from "@/lib/quran";

import {
  countDue,
  countNewIntroducedToday,
  getDueItems,
  getSoonestItems,
  getStartedAyahs,
} from "./db";
import { segmentSurah, type Segment } from "./segments";

/**
 * Builds the daily session following the traditional hifz structure, which
 * FSRS reproduces naturally:
 *  - sabaq: the new segment of the active surah (new ayahs)
 *  - sabqi + manzil: everything due for review (most overdue selected
 *    first), recited in mushaf order
 */
export type SessionItem = {
  surah: number;
  ayah: number;
  kind: "new" | "review";
};

export type SessionPlan = {
  newItems: SessionItem[];
  reviewItems: SessionItem[];
  /** Segment the new items belong to, if any. */
  segment: Segment | null;
  /** Total reviews actually due, before the budget cap. */
  dueTotal: number;
};

/**
 * Session sizing derived from the minutes-per-day chosen in onboarding.
 * `maxNew` is a per-day cap (not per-session): short sessions can be
 * repeated the same day until the cap is reached.
 */
export function budgetFor(minutesPerDay: 5 | 10 | 20): { maxNew: number; maxReviews: number } {
  switch (minutesPerDay) {
    case 5:
      return { maxNew: 3, maxReviews: 8 };
    case 20:
      return { maxNew: 10, maxReviews: 40 };
    default:
      return { maxNew: 5, maxReviews: 20 };
  }
}

/** Same time model the budget uses: about 90s per new verse, 30s per review. */
export function estimateMinutes(plan: SessionPlan): number {
  return Math.max(1, Math.ceil(plan.newItems.length * 1.5 + plan.reviewItems.length * 0.5));
}

/**
 * Reviews are *selected* by urgency (most overdue first, so the budget cap
 * keeps the right ones) but *presented* in mushaf order: a surah is recited
 * in sequence, and each verse is a cue for the next. Sorting by due date
 * alone scrambles a surah, since every verse gets its own interval.
 */
function inMushafOrder(items: SessionItem[]): SessionItem[] {
  return [...items].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

/** The next not-yet-started segment of a surah, or null when all started. */
export function nextSegment(surahId: number): Segment | null {
  const chapter = getChapter(surahId);
  const started = getStartedAyahs(surahId);
  for (const segment of segmentSurah(chapter.versesCount)) {
    for (let a = segment.start; a <= segment.end; a++) {
      if (!started.has(a)) return segment;
    }
  }
  return null;
}

export function buildSessionPlan(activeSurah: number, minutesPerDay: 5 | 10 | 20 = 10): SessionPlan {
  const budget = budgetFor(minutesPerDay);
  const newBudget = Math.max(0, budget.maxNew - countNewIntroducedToday());

  const segment = newBudget > 0 ? nextSegment(activeSurah) : null;
  const started = getStartedAyahs(activeSurah);

  const newItems: SessionItem[] = [];
  if (segment) {
    for (let a = segment.start; a <= segment.end; a++) {
      if (newItems.length >= newBudget) break;
      if (!started.has(a)) newItems.push({ surah: activeSurah, ayah: a, kind: "new" });
    }
  }

  const reviewItems = inMushafOrder(
    getDueItems(Date.now(), budget.maxReviews).map((item) => ({
      surah: item.surah,
      ayah: item.ayah,
      kind: "review" as const,
    }))
  );

  return { newItems, reviewItems, segment, dueTotal: countDue() };
}

/**
 * A voluntary extra session when nothing is due: the soonest scheduled
 * reviews, done early (FSRS handles early reviews natively).
 */
export function buildReviewAheadPlan(limit = 12): SessionPlan {
  const reviewItems = inMushafOrder(
    getSoonestItems(limit).map((item) => ({
      surah: item.surah,
      ayah: item.ayah,
      kind: "review" as const,
    }))
  );
  return { newItems: [], reviewItems, segment: null, dueTotal: 0 };
}
