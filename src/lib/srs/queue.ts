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

/**
 * Serial recall of a whole passage (from..to): the verses are recited in one
 * go, which trains the transitions between them, the real difficulty of
 * hifz. A consolidation exercise: it does not change per-verse FSRS cards.
 */
export type ChainItem = {
  surah: number;
  from: number;
  to: number;
  kind: "chain";
};

export type QueueItem = SessionItem | ChainItem;

/** Builds the session queue: new verses, then their chain, then reviews. */
export function sessionQueue(plan: SessionPlan): QueueItem[] {
  const chain: ChainItem[] =
    plan.newItems.length >= 2
      ? [
          {
            surah: plan.newItems[0].surah,
            from: plan.newItems[0].ayah,
            to: plan.newItems[plan.newItems.length - 1].ayah,
            kind: "chain",
          },
        ]
      : [];
  return [...plan.newItems, ...chain, ...plan.reviewItems];
}

/**
 * Manual review of one surah, on the learner's request (typically a surah
 * declared known, which is never scheduled): every started verse, in order,
 * followed by a chain of the whole surah when it is short.
 */
export function buildSurahReviewQueue(surahId: number): QueueItem[] {
  const ayahs = [...getStartedAyahs(surahId)].sort((a, b) => a - b);
  const items: QueueItem[] = ayahs.map((ayah) => ({ surah: surahId, ayah, kind: "review" as const }));
  return [...items, ...buildChainQueue(surahId)];
}

/**
 * Chain practice on one surah (manzil): one chain per segment whose verses
 * are all started; a short surah (7 verses or fewer) is chained whole.
 */
export function buildChainQueue(surahId: number): ChainItem[] {
  const chapter = getChapter(surahId);
  const started = getStartedAyahs(surahId);
  if (chapter.versesCount <= 7) {
    return started.size === chapter.versesCount && chapter.versesCount >= 2
      ? [{ surah: surahId, from: 1, to: chapter.versesCount, kind: "chain" }]
      : [];
  }
  return segmentSurah(chapter.versesCount)
    .filter((seg) => {
      for (let a = seg.start; a <= seg.end; a++) if (!started.has(a)) return false;
      return true;
    })
    .map((seg) => ({ surah: surahId, from: seg.start, to: seg.end, kind: "chain" as const }));
}

export type SessionPlan = {
  newItems: SessionItem[];
  reviewItems: SessionItem[];
  /** Segment the new items belong to, if any. */
  segment: Segment | null;
  /** Total reviews actually due, before the budget cap. */
  dueTotal: number;
  /**
   * The surah still has verses to learn but today's new-verse cap is used
   * up: the UI says so and offers an explicit extra batch.
   */
  newCapReached: boolean;
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

export function buildSessionPlan(
  activeSurah: number,
  minutesPerDay: 5 | 10 | 20 = 10,
  options: { extraNew?: boolean } = {}
): SessionPlan {
  const budget = budgetFor(minutesPerDay);
  // `extraNew` is the learner explicitly asking for one more batch today.
  const newBudget = options.extraNew
    ? budget.maxNew
    : Math.max(0, budget.maxNew - countNewIntroducedToday());
  const newCapReached = newBudget === 0 && nextSegment(activeSurah) !== null;

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

  return { newItems, reviewItems, segment, dueTotal: countDue(), newCapReached };
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
  return { newItems: [], reviewItems, segment: null, dueTotal: 0, newCapReached: false };
}
