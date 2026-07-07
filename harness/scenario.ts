/**
 * The API scenario files are written against. Deliberately tiny — read it top to bottom.
 *
 * A scenario opens one dedicated database connection per named session and interleaves
 * their statements using plain `await` order. Everything it claims, it asserts.
 */

export type Row = Record<string, any>;
export type Rows = Row[] & {
  command?: string;
  count?: number;
  affectedRows?: number;
};

/**
 * A database error. `code` is what that database's users grep for: the SQLSTATE on
 * PostgreSQL (e.g. "40001"), the error number on MySQL (e.g. "1213").
 */
export interface DbError extends Error {
  code: string;
  detail?: string;
  sqlState?: string;
}

/**
 * A statement fired with `.blocked` — still executing while its session waits on a lock.
 * Consume it with `await pending.success()` (must complete) or `await pending.failure()`
 * (must error, e.g. as a deadlock victim). Deliberately NOT a thenable: `await` would
 * unwrap it and wait for the blocked statement itself.
 */
export interface Pending {
  success(): Promise<Rows>;
  failure(): Promise<DbError>;
}

/** One named database session — a dedicated connection. */
export interface Session {
  /** Run a statement. The scenario fails if it errors. */
  (sql: TemplateStringsArray, ...values: unknown[]): Promise<Rows>;
  /** Run a statement that MUST error. Returns the error for assertions. */
  fails(sql: TemplateStringsArray, ...values: unknown[]): Promise<DbError>;
  /**
   * Fire a statement that MUST block on a lock. Resolves once the backend is provably
   * waiting (observed via the database's lock-wait views), so the interleaving is
   * deterministic.
   */
  blocked(sql: TemplateStringsArray, ...values: unknown[]): Promise<Pending>;
}

export interface Tools {
  /** Add a narrator line to the transcript. */
  note(text: string): void;
  /**
   * A session's backend/connection id — for asserting on monitoring-query results.
   * (Transcripts normalize id columns to pid(A) automatically; assertions see raw ids.)
   */
  pid(session: string): number;
  /**
   * Wait until a session (blocked earlier via `.blocked`) is back in a lock wait.
   * Needed before monitoring queries fired right after another session released a
   * lock: waiters briefly wake up to requeue and momentarily aren't "waiting".
   */
  locked(session: string): Promise<void>;
}

export interface Scenario<S extends readonly string[] = readonly string[]> {
  title: string;
  /** The one claim this scenario proves. Shown in docs and test output. */
  claim: string;
  /** Plain SQL, run once before the sessions open. May contain multiple statements. */
  setup: string;
  sessions: S;
  run(sessions: Record<S[number], Session>, t: Tools): Promise<void>;
}

export function scenario<const S extends readonly string[]>(s: Scenario<S>): Scenario<S> {
  return s;
}

/** Assert deep equality. Failures abort the scenario — they never appear in transcripts. */
export function eq(actual: unknown, expected: unknown, message?: string): void {
  if (!Bun.deepEquals(actual, expected, true)) {
    throw new Error(
      `${message ?? "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
