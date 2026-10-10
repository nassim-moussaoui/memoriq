/**
 * Test double of expo-sqlite's synchronous API (the subset src/lib/srs/db.ts
 * uses), backed by a real in-memory SQLite through better-sqlite3, so the
 * learning engine runs its actual SQL in Jest.
 */
import Database from 'better-sqlite3';

type Params = (string | number | null)[];

class SyncDatabase {
  private db = new Database(':memory:');

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  runSync(sql: string, params: Params = []): void {
    this.db.prepare(sql).run(...params);
  }

  getAllSync<T>(sql: string, params: Params = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  getFirstSync<T>(sql: string, params: Params = []): T | null {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }
}

export function openDatabaseSync(): SyncDatabase {
  return new SyncDatabase();
}
