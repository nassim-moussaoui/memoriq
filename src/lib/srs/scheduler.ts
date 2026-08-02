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
    // Target 90% recall probability — the FSRS default, well suited to
    // verbatim memorization where accuracy matters.
    request_retention: 0.9,
  })
);

export { Rating, State };
export type { Card, Grade };

export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/** Grade = Again | Hard | Good | Easy (Rating minus Manual). */
export function rate(card: Card, rating: Grade, now: Date = new Date()): Card {
  return engine.next(card, now, rating).card;
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
