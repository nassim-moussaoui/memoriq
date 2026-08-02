import { getChapter } from "@/lib/quran";

import { getDueItems, getSoonestItems, getStartedAyahs } from "./db";
import { segmentSurah, type Segment } from "./segments";

/**
 * Builds the daily session following the traditional hifz structure, which
 * FSRS reproduces naturally:
 *  - sabaq: the new segment of the active surah (new ayahs)
 *  - sabqi + manzil: everything due for review, most overdue first
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
};

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

export function buildSessionPlan(activeSurah: number, maxReviews = 40): SessionPlan {
  const segment = nextSegment(activeSurah);
  const started = getStartedAyahs(activeSurah);

  const newItems: SessionItem[] = [];
  if (segment) {
    for (let a = segment.start; a <= segment.end; a++) {
      if (!started.has(a)) newItems.push({ surah: activeSurah, ayah: a, kind: "new" });
    }
  }

  const reviewItems: SessionItem[] = getDueItems(Date.now(), maxReviews).map((item) => ({
    surah: item.surah,
    ayah: item.ayah,
    kind: "review" as const,
  }));

  return { newItems, reviewItems, segment };
}

/**
 * A voluntary extra session when nothing is due: the soonest scheduled
 * reviews, done early (FSRS handles early reviews natively).
 */
export function buildReviewAheadPlan(limit = 12): SessionPlan {
  const reviewItems: SessionItem[] = getSoonestItems(limit).map((item) => ({
    surah: item.surah,
    ayah: item.ayah,
    kind: "review" as const,
  }));
  return { newItems: [], reviewItems, segment: null };
}
