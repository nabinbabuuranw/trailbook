// Minimal D1-compatible surface used by the Worker. Cloudflare's D1 binding satisfies it; so does the
// local SQLite adapter in api/test/d1-node.ts, which runs the same SQL in the tests.
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  meta?: { changes?: number; last_row_id?: number };
}

export interface D1StmtLike {
  bind(...values: unknown[]): D1StmtLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
}

export interface D1Like {
  prepare(sql: string): D1StmtLike;
  batch(statements: D1StmtLike[]): Promise<D1Result[]>;
}
