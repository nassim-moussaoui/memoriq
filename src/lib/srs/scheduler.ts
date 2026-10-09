import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

/**
 * FSRS (Free Spaced Repetition Scheduler) engine. Each ayah the user is
 * memorizing has its own Card; every self-evaluation feeds `rate()` which
 * returns the updated card with the next review date.
 */
const engine = fsrs(
  generatorParameters({
    enable_fuzz: true,
    // Target 90% recall probability: the FSRS default, well suited to
    // verbatim memorization where accuracy matters.
    request_retention: 0.9,
    // No minute-level learning steps: a verse is never "due again in 10 min"
    // outside the session. The session itself handles short-term repetition
    // (listen, recite, and an immediate retry after "Again"), so every
    // stored interval is at least a day and reads naturally ("tomorrow").
    learning_steps: [],
    relearning_steps: [],
  })
);

export { Rating, State };
export type { Card, Grade };

export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/** Grade = Again | Hard | Good | Easy (Rating minus Manual). */
export function rate(card: Card, rating: Grade, now: Date = new Date()): Card {
  // ts-fsrs copies unknown fields over; drop the "declared known" flag (see
  // srs/known.ts) so a real review turns it into verified progress.
  const next = engine.next(card, now, rating).card as Card & { known?: true };
  delete next.known;
  return next;
}

/**
 * Minutes until the next review for each possible grade (interval preview on
 * the rating buttons).
 */
export function previewIntervals(card: Card, now: Date = new Date()): Record<Grade, number> {
  const log = engine.repeat(card, now);
  const minutes = (due: Date) => Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
  return {
    [Rating.Again]: minutes(log[Rating.Again].card.due),
    [Rating.Hard]: minutes(log[Rating.Hard].card.due),
    [Rating.Good]: minutes(log[Rating.Good].card.due),
    [Rating.Easy]: minutes(log[Rating.Easy].card.due),
  };
}

/** Serialization helpers: FSRS cards contain Date fields. */
export type SerializedCard = Omit<Card, "due" | "last_review"> & {
  due: string | Date;
  last_review?: string | Date | null;
};

export function serializeCard(card: Card): string {
  return JSON.stringify(card);
}

/** Revives a card parsed from JSON (SQLite text column or Postgres jsonb). */
export function reviveCard(raw: SerializedCard): Card {
  return {
    ...raw,
    due: new Date(raw.due),
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  };
}

export function deserializeCard(json: string): Card {
  return reviveCard(JSON.parse(json));
}
