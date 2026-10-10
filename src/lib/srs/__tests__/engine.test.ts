import { beforeEach, describe, expect, it } from '@jest/globals';

import { getChapter } from '@/lib/quran';
import { useAppStore } from '@/lib/store';

import {
  countDue,
  getDueForecast,
  getItem,
  getLogsAfter,
  getNextDueAt,
  getStartedAyahs,
  getSurahStatuses,
  logReview,
  resetDatabase,
  saveItem,
} from '../db';
import { getKnownAyahs, markSurahsKnown, unmarkSurahKnown } from '../known';
import {
  budgetFor,
  buildChainQueue,
  buildReviewAheadPlan,
  buildSessionPlan,
  buildSurahReviewQueue,
  sessionQueue,
} from '../queue';
import { newCard, previewIntervals, rate, Rating, State } from '../scheduler';
import { segmentSurah } from '../segments';

const DAY = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

/** A verse learned at `learnedAt`, due at `dueAt`. */
function saveReviewCard(surah: number, ayah: number, learnedAt: number, dueAt: number) {
  const card = rate(newCard(new Date(learnedAt)), Rating.Good, new Date(learnedAt));
  saveItem(surah, ayah, { ...card, due: new Date(dueAt) });
}

beforeEach(() => {
  resetDatabase();
  useAppStore.setState({ pendingDeletes: [] });
});

describe('segments (chunking)', () => {
  it('covers every surah in contiguous segments of 3 to 5 verses', () => {
    for (let id = 1; id <= 114; id++) {
      const { versesCount } = getChapter(id);
      const segments = segmentSurah(versesCount);
      expect(segments[0].start).toBe(1);
      expect(segments[segments.length - 1].end).toBe(versesCount);
      segments.forEach((seg, i) => {
        if (i > 0) expect(seg.start).toBe(segments[i - 1].end + 1);
        const size = seg.end - seg.start + 1;
        if (versesCount > 5) {
          expect(size).toBeGreaterThanOrEqual(3);
          expect(size).toBeLessThanOrEqual(5);
        }
      });
    }
  });
});

describe('scheduler (FSRS)', () => {
  it('never schedules a verse minutes away: every interval is at least a day', () => {
    const previews = previewIntervals(newCard());
    for (const grade of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
      expect(previews[grade]).toBeGreaterThanOrEqual(MINUTES_PER_DAY);
    }
  });

  it('gives longer intervals to better answers', () => {
    const p = previewIntervals(newCard());
    expect(p[Rating.Easy]).toBeGreaterThan(p[Rating.Good]);
    expect(p[Rating.Good]).toBeGreaterThanOrEqual(p[Rating.Hard]);
  });

  it('drops the "declared known" flag on a real review', () => {
    const known = { ...rate(newCard(), Rating.Easy), known: true as const };
    const reviewed = rate(known, Rating.Good, new Date(Date.now() + 8 * DAY));
    expect((reviewed as { known?: boolean }).known).toBeUndefined();
  });
});

describe('daily session', () => {
  it('starts a fresh learner on the first segment of the surah', () => {
    const plan = buildSessionPlan(114, 10);
    expect(plan.newItems.map((i) => i.ayah)).toEqual([1, 2, 3]);
    expect(plan.reviewItems).toEqual([]);
    expect(plan.newCapReached).toBe(false);
  });

  it('presents due reviews in mushaf order, whatever their due dates', () => {
    const now = Date.now();
    const dueOffsets = [3, 1, 5, 2, 4]; // ayahs 1..5 come due in a scrambled order
    dueOffsets.forEach((offset, i) => saveReviewCard(113, i + 1, now - 10 * DAY, now - offset * 60_000));
    saveReviewCard(112, 2, now - 10 * DAY, now - 9 * 60_000);

    const plan = buildSessionPlan(114, 10);
    expect(plan.reviewItems.map((i) => `${i.surah}:${i.ayah}`)).toEqual([
      '112:2',
      '113:1',
      '113:2',
      '113:3',
      '113:4',
      '113:5',
    ]);
  });

  it('still picks the most overdue reviews when the budget is smaller than the backlog', () => {
    const now = Date.now();
    const { maxReviews } = budgetFor(5);
    for (let ayah = 1; ayah <= maxReviews + 3; ayah++) {
      // Higher ayahs are more overdue.
      saveReviewCard(2, ayah, now - 30 * DAY, now - ayah * DAY);
    }
    const plan = buildSessionPlan(114, 5);
    expect(plan.reviewItems).toHaveLength(maxReviews);
    expect(plan.reviewItems.map((i) => i.ayah)).toEqual(
      Array.from({ length: maxReviews }, (_, i) => i + 4),
    );
  });

  it('reports the daily new-verse cap, and lifts it only on explicit request', () => {
    const { maxNew } = budgetFor(10);
    for (let ayah = 1; ayah <= maxNew; ayah++) {
      saveReviewCard(1, ayah, Date.now(), Date.now() + DAY);
      logReview(1, ayah, Rating.Good);
    }
    const capped = buildSessionPlan(114, 10);
    expect(capped.newItems).toEqual([]);
    expect(capped.newCapReached).toBe(true);

    const extra = buildSessionPlan(114, 10, { extraNew: true });
    expect(extra.newItems.length).toBeGreaterThan(0);
  });

  it('chains the new verses of a segment right after learning them', () => {
    const queue = sessionQueue(buildSessionPlan(114, 10));
    expect(queue.map((q) => q.kind)).toEqual(['new', 'new', 'new', 'chain']);
    expect(queue[3]).toMatchObject({ kind: 'chain', surah: 114, from: 1, to: 3 });
  });

  it('reviews ahead in mushaf order', () => {
    const now = Date.now();
    saveReviewCard(114, 3, now, now + 2 * DAY);
    saveReviewCard(114, 1, now, now + 3 * DAY);
    saveReviewCard(114, 2, now, now + DAY);
    expect(buildReviewAheadPlan().reviewItems.map((i) => i.ayah)).toEqual([1, 2, 3]);
  });
});

describe('chain practice', () => {
  it('offers a short surah as one chain once every verse is started', () => {
    expect(buildChainQueue(112)).toEqual([]);
    for (let ayah = 1; ayah <= 4; ayah++) saveReviewCard(112, ayah, Date.now(), Date.now() + DAY);
    expect(buildChainQueue(112)).toEqual([{ surah: 112, from: 1, to: 4, kind: 'chain' }]);
  });
});

describe('already known surahs', () => {
  it('records unstarted verses as learned, without touching the review log', () => {
    const now = Date.now();
    const added = markSurahsKnown([112, 113], now);
    expect(added).toBe(4 + 5);
    expect(getItem(112, 1)?.state).toBe(State.Review);
    expect(getLogsAfter(0)).toEqual([]);
    expect(buildSessionPlan(114, 10).newCapReached).toBe(false);
  });

  it('never schedules them, even long after: they count as learned, not as due', () => {
    const now = Date.now();
    markSurahsKnown([112], now - 60 * DAY);
    expect(countDue(now)).toBe(0);
    expect(buildSessionPlan(114, 10).reviewItems).toEqual([]);
    expect(buildReviewAheadPlan().reviewItems).toEqual([]);
    expect(getNextDueAt(now)).toBeNull();
    expect(getDueForecast(7, now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect([...getSurahStatuses(112, now).values()]).toEqual(['learned', 'learned', 'learned', 'learned']);
  });

  it('lets the learner review a known surah, which then follows spaced repetition', () => {
    const now = Date.now();
    markSurahsKnown([112], now - 60 * DAY);
    const queue = buildSurahReviewQueue(112);
    expect(queue.map((q) => (q.kind === 'chain' ? 'chain' : q.ayah))).toEqual([1, 2, 3, 4, 'chain']);

    const verse1 = getItem(112, 1)!;
    saveItem(112, 1, rate(verse1.card, Rating.Hard, new Date(now)));
    expect(getKnownAyahs(112)).toEqual([2, 3, 4]);
    expect(buildReviewAheadPlan().reviewItems.map((i) => i.ayah)).toEqual([1]);
  });

  it('skips verses already started', () => {
    saveReviewCard(112, 1, Date.now(), Date.now() + DAY);
    expect(markSurahsKnown([112])).toBe(3);
  });

  it('undoes only the verses never reviewed since, and queues the cloud deletion', () => {
    markSurahsKnown([112]);
    const verse2 = getItem(112, 2)!;
    saveItem(112, 2, rate(verse2.card, Rating.Good, new Date(verse2.dueAt)));
    expect(getKnownAyahs(112)).toEqual([1, 3, 4]);

    expect(unmarkSurahKnown(112)).toBe(3);
    expect([...getStartedAyahs(112)]).toEqual([2]);
    expect(useAppStore.getState().pendingDeletes).toEqual([
      { surah: 112, ayah: 1 },
      { surah: 112, ayah: 3 },
      { surah: 112, ayah: 4 },
    ]);
  });
});
