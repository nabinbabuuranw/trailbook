// Test-only adapter: runs the Worker's SQL on node:sqlite (SQLite, the engine under D1).
// Each batch runs synchronously inside one BEGIN/COMMIT, so a batch is atomic against other requests.
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { D1Like, D1StmtLike, D1Result } from '../src/d1.ts';

type Bindable = string | number | bigint | null | Uint8Array;

function norm(v: unknown): Bindable {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  throw new Error('unbindable value');
}

export function createNodeD1(): D1Like & { raw: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  const runSync = (sql: string, params: Bindable[]): D1Result => {
    const st: StatementSync = db.prepare(sql);
    const r = st.run(...params);
    return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };

  class Stmt implements D1StmtLike {
    readonly sql: string;
    readonly params: Bindable[];
    constructor(sql: string, params: Bindable[] = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...values: unknown[]): D1StmtLike {
      return new Stmt(this.sql, values.map(norm));
    }
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      const row = db.prepare(this.sql).get(...this.params);
      return (row ?? null) as T | null;
    }
    async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
      return { results: db.prepare(this.sql).all(...this.params) as T[] };
    }
    async run(): Promise<D1Result> {
      return runSync(this.sql, this.params);
    }
  }

  return {
    raw: db,
    prepare: (sql: string) => new Stmt(sql),
    async batch(statements: D1StmtLike[]): Promise<D1Result[]> {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out: D1Result[] = [];
        for (const s of statements as Stmt[]) out.push(runSync(s.sql, s.params));
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
