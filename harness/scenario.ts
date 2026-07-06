/**
 * The API scenario files are written against. Deliberately tiny — read it top to bottom.
 *
 * A scenario opens one dedicated PostgreSQL connection per named session and interleaves
 * their statements using plain `await` order. Everything it claims, it asserts.
 */

export type Row = Record<string, any>;
export type Rows = Row[] & { command?: string; count?: number };

/** A PostgreSQL error; `code` is the SQLSTATE, e.g. "40001". */
export interface PgError extends Error {
  code: string;
  detail?: string;
}

/**
 * A statement fired with `.blocked` — still executing while its session waits on a lock.
 * Consume it with `await pending.success()` (must complete) or `await pending.failure()`
 * (must error, e.g. as a deadlock victim). Deliberately NOT a thenable: `await` would
 * unwrap it and wait for the blocked statement itself.
 */
export interface Pending {
  success(): Promise<Rows>;
  failure(): Promise<PgError>;
}

/** One named database session — a dedicated PostgreSQL connection. */
export interface Session {
  /** Run a statement. The scenario fails if it errors. */
  (sql: TemplateStringsArray, ...values: unknown[]): Promise<Rows>;
  /** Run a statement that MUST error. Returns the error for assertions. */
  fails(sql: TemplateStringsArray, ...values: unknown[]): Promise<PgError>;
  /**
   * Fire a statement that MUST block on a lock. Resolves once the backend is provably
   * waiting (observed via pg_stat_activity), so the interleaving is deterministic.
   */
  blocked(sql: TemplateStringsArray, ...values: unknown[]): Promise<Pending>;
}

export interface Tools {
  /** Add a narrator line to the transcript. */
  note(text: string): void;
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
