import type { ReservedSQL } from "bun";
import type { Dialect } from "./dialect";
import type { DbError, Pending, Rows, Scenario, Session } from "./scenario";
import { renderMarkdown } from "./transcript";

export type Event =
  | { kind: "query"; session: string; sql: string; rows: Rows; tl?: string }
  | { kind: "error"; session: string; sql: string; error: DbError; tl?: string }
  | { kind: "blocked"; session: string; sql: string; tl?: string }
  | { kind: "resume"; session: string; sql: string; rows: Rows; tl?: string }
  | { kind: "resume-error"; session: string; sql: string; error: DbError; tl?: string }
  | { kind: "note"; text: string };

export interface RunResult {
  events: Event[];
  /** session name → backend/connection id, used to normalize ids in transcripts */
  pids: Record<string, number>;
}

/** Optional observers, used by `bun lesson` to replay a scenario live on the console. */
export interface RunHooks {
  /** Sessions are open; pids are known (a live renderer needs them to normalize). */
  ready?(pids: Record<string, number>): void;
  /** About to execute a statement. Step mode pauses here. */
  before?(session: string, sql: string): void | Promise<void>;
  /** A transcript event just happened. */
  event?(e: Event): void;
}

/** How long we wait for an expected lock wait to show up before calling the claim false. */
const BLOCK_DEADLINE_MS = 10_000;

export async function runScenario(s: Scenario<any>, dialect: Dialect, hooks?: RunHooks): Promise<RunResult> {
  const sql = dialect.connect(s.sessions.length + 1);
  const events: Event[] = [];
  const emit = (e: Event) => {
    events.push(e);
    hooks?.event?.(e);
  };
  const pids: Record<string, number> = {};
  const unconsumed = new Set<PendingImpl>();

  try {
    // Clean slate: drop everything the previous scenario left behind.
    const admin = await sql.reserve();
    await dialect.reset(admin);
    await admin.unsafe(s.setup);

    // The admin connection doubles as the monitor for blocked-statement detection.
    const sessions: Record<string, Session> = {};
    for (const name of s.sessions) {
      const conn = await sql.reserve();
      pids[name] = await dialect.openSession(conn, name);
      sessions[name] = makeSession(name, pids[name]!, conn, admin, dialect, emit, unconsumed, hooks);
    }
    hooks?.ready?.(pids);

    // When a lock holder releases, waiters further down the queue briefly wake up to
    // requeue — a monitoring query fired in that window sees them as not waiting. This
    // fence (invisible in transcripts) polls until the backend is provably back in a
    // lock wait, the same signal `.blocked` uses.
    const locked = async (name: string) => {
      const deadline = Date.now() + BLOCK_DEADLINE_MS;
      while (!(await dialect.isBlocked(admin, pids[name]!))) {
        if (Date.now() > deadline) {
          throw new Error(`[${name}] not in a lock wait within ${BLOCK_DEADLINE_MS}ms`);
        }
        await Bun.sleep(15);
      }
    };

    try {
      await s.run(sessions, {
        note: (text) => emit({ kind: "note", text }),
        pid: (name) => pids[name]!,
        locked,
      });
    } catch (e: any) {
      // Append the transcript so far — a failing scenario is debugged from its own story.
      e.message += `\n\n--- transcript up to the failure ---\n${renderMarkdown({ events, pids }, dialect)}`;
      throw e;
    }

    if (unconsumed.size > 0) {
      const left = [...unconsumed].map((p) => `[${p.session}] ${p.sql}`).join("; ");
      throw new Error(`scenario ended with unresolved blocked statements: ${left}`);
    }

    return { events, pids };
  } finally {
    // Cancel anything still running (e.g. a blocked statement in a failed scenario),
    // then drop the pool. The server rolls back open transactions on disconnect.
    try {
      const canceller = dialect.connect(1);
      for (const pid of Object.values(pids)) {
        await dialect.cancel(canceller, pid);
      }
      await canceller.close();
    } catch {}
    await sql.close({ timeout: 1 }).catch(() => {});
  }
}

function makeSession(
  name: string,
  pid: number,
  conn: ReservedSQL,
  monitor: ReservedSQL,
  dialect: Dialect,
  emit: (e: Event) => void,
  unconsumed: Set<PendingImpl>,
  hooks?: RunHooks,
): Session {
  const call = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows> => {
    const text = renderSql(strings, values);
    const tl = (strings as any).tl as string | undefined;
    await hooks?.before?.(name, text);
    try {
      const rows = await dialect.exec(conn, strings, values, text);
      emit({ kind: "query", session: name, sql: text, rows, tl });
      return rows;
    } catch (raw: any) {
      const e = dialect.toError(raw);
      emit({ kind: "error", session: name, sql: text, error: e, tl });
      throw new Error(`[${name}] unexpected error (${e.code}) on: ${text}\n${e.message}`);
    }
  };

  call.fails = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<DbError> => {
    const text = renderSql(strings, values);
    const tl = (strings as any).tl as string | undefined;
    await hooks?.before?.(name, text);
    try {
      await dialect.exec(conn, strings, values, text);
    } catch (raw: any) {
      const e = dialect.toError(raw);
      emit({ kind: "error", session: name, sql: text, error: e, tl });
      return e;
    }
    throw new Error(`[${name}] expected an error, but statement succeeded: ${text}`);
  };

  call.blocked = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Pending> => {
    const text = renderSql(strings, values);
    const tl = (strings as any).tl as string | undefined;
    await hooks?.before?.(name, text);
    const executing = dialect.exec(conn, strings, values, text);
    executing.catch(() => {}); // consumed later via pending.success() / pending.failure()

    // The claim "this statement blocks" is itself verified: we poll the database's
    // lock-wait view until the backend reports a lock wait. If the statement completes
    // instead, the scenario fails — exactly what a false claim deserves.
    const deadline = Date.now() + BLOCK_DEADLINE_MS;
    while (true) {
      const state = await Promise.race([
        executing.then(
          () => "completed",
          () => "errored",
        ),
        Bun.sleep(15).then(() => "waiting"),
      ]);
      if (state !== "waiting") {
        throw new Error(`[${name}] expected to block, but statement ${state}: ${text}`);
      }
      if (await dialect.isBlocked(monitor, pid)) break;
      if (Date.now() > deadline) {
        throw new Error(`[${name}] statement never blocked within ${BLOCK_DEADLINE_MS}ms: ${text}`);
      }
    }

    emit({ kind: "blocked", session: name, sql: text, tl });
    const pending = new PendingImpl(name, text, tl, executing, dialect, emit, unconsumed);
    unconsumed.add(pending);
    return pending;
  };

  return call;
}

class PendingImpl implements Pending {
  constructor(
    readonly session: string,
    readonly sql: string,
    readonly tl: string | undefined,
    private executing: Promise<Rows>,
    private dialect: Dialect,
    private emit: (e: Event) => void,
    private unconsumed: Set<PendingImpl>,
  ) {}

  success(): Promise<Rows> {
    this.unconsumed.delete(this);
    return this.executing.then(
      (rows) => {
        this.emit({
          kind: "resume",
          session: this.session,
          sql: this.sql,
          rows,
          tl: this.tl,
        });
        return rows;
      },
      (raw: any) => {
        const e = this.dialect.toError(raw);
        this.emit({
          kind: "resume-error",
          session: this.session,
          sql: this.sql,
          error: e,
          tl: this.tl,
        });
        throw new Error(
          `[${this.session}] blocked statement failed unexpectedly (${e.code}): ${this.sql}\n${e.message}`,
        );
      },
    );
  }

  failure(): Promise<DbError> {
    this.unconsumed.delete(this);
    return this.executing.then(
      () => {
        throw new Error(`[${this.session}] expected blocked statement to fail, but it succeeded: ${this.sql}`);
      },
      (raw: any) => {
        const e = this.dialect.toError(raw);
        this.emit({
          kind: "resume-error",
          session: this.session,
          sql: this.sql,
          error: e,
          tl: this.tl,
        });
        return e;
      },
    );
  }
}

/** Render a tagged-template statement as the literal SQL shown in transcripts. */
function renderSql(strings: TemplateStringsArray, values: unknown[]): string {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += literal(v) + (strings[i + 1] ?? "");
  });
  return dedent(out);
}

function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function dedent(text: string): string {
  const lines = text.replace(/^\n/, "").trimEnd().split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length);
  const cut = Math.min(...indents);
  return lines
    .map((l) => l.slice(cut))
    .join("\n")
    .trim();
}
