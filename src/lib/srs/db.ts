import * as SQLite from "expo-sqlite";

import { deserializeCard, serializeCard, State, type Card } from "./scheduler";

/**
 * Local, offline-first persistence of the memorization state. One row per
 * (surah, ayah) the user has started learning. Will be synced to Supabase in
 * a later phase; SQLite stays the source of truth on device.
 */
const db = SQLite.openDatabaseSync("memoriq.db");

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS memorization_items (
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    card TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    state INTEGER NOT NULL,
    PRIMARY KEY (surah, ayah)
  );
  CREATE INDEX IF NOT EXISTS idx_items_due ON memorization_items (due_at);
  CREATE TABLE IF NOT EXISTS review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    reviewed_at INTEGER NOT NULL
  );
`);

/**
 * Verses ticked as "already known" carry a `known` flag in their card JSON
 * (see srs/known.ts). They count as learned but are never scheduled: every
 * query feeding reviews (due items, next due date, review ahead, forecast,
 * badge) filters them out. A manual review drops the flag, and the verse
 * then follows normal spaced repetition.
 */
const SCHEDULED = "json_extract(card, '$.known') IS NULL";

export type ItemRow = {
  surah: number;
  ayah: number;
  card: Card;
  dueAt: number;
  state: State;
};

type RawRow = { surah: number; ayah: number; card: string; due_at: number; state: number };

function toItem(row: RawRow): ItemRow {
  return {
    surah: row.surah,
    ayah: row.ayah,
    card: deserializeCard(row.card),
    dueAt: row.due_at,
    state: row.state as State,
  };
}

export function getItem(surah: number, ayah: number): ItemRow | null {
  const row = db.getFirstSync<RawRow>(
    "SELECT * FROM memorization_items WHERE surah = ? AND ayah = ?",
    [surah, ayah]
  );
  return row ? toItem(row) : null;
}

export function saveItem(surah: number, ayah: number, card: Card): void {
  db.runSync(
    `INSERT INTO memorization_items (surah, ayah, card, due_at, state)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (surah, ayah) DO UPDATE SET card = excluded.card, due_at = excluded.due_at, state = excluded.state`,
    [surah, ayah, serializeCard(card), card.due.getTime(), card.state]
  );
}

/** Removes one ayah from local learning state (its logs are kept). */
export function deleteItem(surah: number, ayah: number): void {
  db.runSync("DELETE FROM memorization_items WHERE surah = ? AND ayah = ?", [surah, ayah]);
}

export function logReview(surah: number, ayah: number, rating: number, now: number = Date.now()): void {
  db.runSync(
    "INSERT INTO review_logs (surah, ayah, rating, reviewed_at) VALUES (?, ?, ?, ?)",
    [surah, ayah, rating, now]
  );
}

/** All items due for review, most overdue first. */
export function getDueItems(now: number = Date.now(), limit = 50): ItemRow[] {
  const rows = db.getAllSync<RawRow>(
    `SELECT * FROM memorization_items WHERE due_at <= ? AND ${SCHEDULED} ORDER BY due_at ASC LIMIT ?`,
    [now, limit]
  );
  return rows.map(toItem);
}

/** Timestamp of the next scheduled review strictly in the future, or null. */
export function getNextDueAt(now: number = Date.now()): number | null {
  const row = db.getFirstSync<{ next: number | null }>(
    `SELECT MIN(due_at) AS next FROM memorization_items WHERE due_at > ? AND ${SCHEDULED}`,
    [now]
  );
  return row?.next ?? null;
}

/** The soonest scheduled (not yet due) items, for reviewing ahead of time. */
export function getSoonestItems(limit = 12, now: number = Date.now()): ItemRow[] {
  const rows = db.getAllSync<RawRow>(
    `SELECT * FROM memorization_items WHERE due_at > ? AND ${SCHEDULED} ORDER BY due_at ASC LIMIT ?`,
    [now, limit]
  );
  return rows.map(toItem);
}

export function countDue(now: number = Date.now()): number {
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM memorization_items WHERE due_at <= ? AND ${SCHEDULED}`,
    [now]
  );
  return row?.n ?? 0;
}

/**
 * Number of verses introduced today (their first rating ever is today).
 * Used to enforce the daily new-material cap of the session budget.
 */
export function countNewIntroducedToday(now: number = Date.now()): number {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT MIN(reviewed_at) AS first_at FROM review_logs GROUP BY surah, ayah
     ) WHERE first_at >= ?`,
    [startOfDay.getTime()]
  );
  return row?.n ?? 0;
}

/** Ayah numbers of a surah the user has already started learning. */
export function getStartedAyahs(surah: number): Set<number> {
  const rows = db.getAllSync<{ ayah: number }>(
    "SELECT ayah FROM memorization_items WHERE surah = ?",
    [surah]
  );
  return new Set(rows.map((r) => r.ayah));
}

/** Per-surah count of ayahs in Review state (i.e. considered memorized). */
export function getMemorizedCountBySurah(): Map<number, number> {
  const rows = db.getAllSync<{ surah: number; n: number }>(
    "SELECT surah, COUNT(*) AS n FROM memorization_items WHERE state = ? GROUP BY surah",
    [State.Review]
  );
  return new Map(rows.map((r) => [r.surah, r.n]));
}

export function getStartedCountBySurah(): Map<number, number> {
  const rows = db.getAllSync<{ surah: number; n: number }>(
    "SELECT surah, COUNT(*) AS n FROM memorization_items GROUP BY surah"
  );
  return new Map(rows.map((r) => [r.surah, r.n]));
}

export type Totals = {
  startedVerses: number;
  memorizedVerses: number;
  totalReviews: number;
  reviewsToday: number;
};

export function getTotals(now: number = Date.now()): Totals {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const started = db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM memorization_items");
  const memorized = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM memorization_items WHERE state = ?",
    [State.Review]
  );
  const reviews = db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM review_logs");
  const today = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM review_logs WHERE reviewed_at >= ?",
    [startOfDay.getTime()]
  );
  return {
    startedVerses: started?.n ?? 0,
    memorizedVerses: memorized?.n ?? 0,
    totalReviews: reviews?.n ?? 0,
    reviewsToday: today?.n ?? 0,
  };
}

export function getAllItems(): ItemRow[] {
  const rows = db.getAllSync<RawRow>("SELECT * FROM memorization_items");
  return rows.map(toItem);
}

export type LogRow = {
  id: number;
  surah: number;
  ayah: number;
  rating: number;
  reviewedAt: number;
};

/** Review logs with a local id greater than `afterId`, oldest first. */
export function getLogsAfter(afterId: number, limit = 1000): LogRow[] {
  const rows = db.getAllSync<{
    id: number;
    surah: number;
    ayah: number;
    rating: number;
    reviewed_at: number;
  }>(
    "SELECT id, surah, ayah, rating, reviewed_at FROM review_logs WHERE id > ? ORDER BY id ASC LIMIT ?",
    [afterId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    surah: r.surah,
    ayah: r.ayah,
    rating: r.rating,
    reviewedAt: r.reviewed_at,
  }));
}

/**
 * Merges a remote card into local state. The card with more reps wins (a
 * later due date breaks ties): reviews only ever add reps, so the higher
 * count is the more recent history. Returns true when the remote card won.
 */
export function mergeRemoteItem(surah: number, ayah: number, remote: Card): boolean {
  const local = getItem(surah, ayah);
  if (local) {
    const l = local.card;
    const localWins =
      l.reps > remote.reps ||
      (l.reps === remote.reps && l.due.getTime() >= remote.due.getTime());
    if (localWins) return false;
  }
  saveItem(surah, ayah, remote);
  return true;
}

/** Daily review counts for the last `days` days (for the stats heatmap). */
export function getDailyReviewCounts(days = 90, now: number = Date.now()): Map<string, number> {
  const since = now - days * 24 * 60 * 60 * 1000;
  const rows = db.getAllSync<{ day: string; n: number }>(
    `SELECT date(reviewed_at / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
     FROM review_logs WHERE reviewed_at >= ? GROUP BY day`,
    [since]
  );
  return new Map(rows.map((r) => [r.day, r.n]));
}

/**
 * Reviews falling due on each of the next `days` local days, today first.
 * Anything already overdue counts for today.
 */
export function getDueForecast(days = 7, now: number = Date.now()): number[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  const rows = db.getAllSync<{ due_at: number }>(
    `SELECT due_at FROM memorization_items WHERE due_at < ? AND ${SCHEDULED}`,
    [end.getTime()]
  );
  const counts = new Array<number>(days).fill(0);
  for (const { due_at } of rows) {
    const day = new Date(due_at);
    day.setHours(0, 0, 0, 0);
    const offset = Math.round((day.getTime() - start.getTime()) / 86_400_000);
    counts[Math.min(Math.max(offset, 0), days - 1)] += 1;
  }
  return counts;
}

/** Share of reviews over the last `days` days not rated "Again", or null. */
export function getSuccessRate(days = 30, now: number = Date.now()): number | null {
  const row = db.getFirstSync<{ total: number; ok: number }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN rating > 1 THEN 1 ELSE 0 END) AS ok
     FROM review_logs WHERE reviewed_at >= ?`,
    [now - days * 24 * 60 * 60 * 1000]
  );
  if (!row || row.total === 0) return null;
  return row.ok / row.total;
}

export type VerseStatus = "learning" | "due" | "learned";

/**
 * Learning status of every started ayah of a surah: "due" when a review is
 * waiting, "learned" once in Review state, "learning" otherwise.
 */
export function getSurahStatuses(surah: number, now: number = Date.now()): Map<number, VerseStatus> {
  const rows = db.getAllSync<{ ayah: number; due_at: number; state: number; known: number | null }>(
    "SELECT ayah, due_at, state, json_extract(card, '$.known') AS known FROM memorization_items WHERE surah = ?",
    [surah]
  );
  return new Map(
    rows.map((r) => [
      r.ayah,
      r.known ? "learned" : r.due_at <= now ? "due" : r.state === State.Review ? "learned" : "learning",
    ])
  );
}

/** Erases all learning state on this phone (cards and review history). */
export function resetDatabase(): void {
  db.execSync("DELETE FROM memorization_items; DELETE FROM review_logs;");
}
