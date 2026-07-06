import type { ReservedSQL } from "bun";
import { connect } from "./db";
import type { PgError, Pending, Rows, Scenario, Session } from "./scenario";
import { renderMarkdown } from "./transcript";

export type Event =
  | { kind: "query"; session: string; sql: string; rows: Rows }
  | { kind: "error"; session: string; sql: string; error: PgError }
  | { kind: "blocked"; session: string; sql: string }
  | { kind: "resume"; session: string; rows: Rows }
  | { kind: "resume-error"; session: string; error: PgError }
  | { kind: "note"; text: string };

export interface RunResult {
  events: Event[];
  /** session name → backend pid, used to normalize pids in transcripts */
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

export async function runScenario(s: Scenario<any>, hooks?: RunHooks): Promise<RunResult> {
  const sql = connect(s.sessions.length + 1);
  const events: Event[] = [];
  const emit = (e: Event) => {
    events.push(e);
    hooks?.event?.(e);
  };
  const pids: Record<string, number> = {};
  const unconsumed = new Set<PendingImpl>();

  try {
    // Clean slate: drop everything the previous scenario left behind, including
    // prepared transactions (they survive disconnects — that's their whole point).
    const admin = await sql.reserve();
    for (const { gid } of await admin`SELECT gid FROM pg_prepared_xacts`) {
      await admin.unsafe(`ROLLBACK PREPARED '${String(gid).replace(/'/g, "''")}'`);
    }
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.unsafe(s.setup);

    // The admin connection doubles as the monitor for blocked-statement detection.
    const sessions: Record<string, Session> = {};
    for (const name of s.sessions) {
      const conn = await sql.reserve();
      // application_name = session name, so monitoring queries (pg_stat_activity,
      // pg_locks) can identify sessions deterministically in transcripts.
      const [row] = await conn`
        SELECT set_config('application_name', ${name}, false), pg_backend_pid() AS pid`;
      pids[name] = row!.pid;
      sessions[name] = makeSession(name, row!.pid, conn, admin, emit, unconsumed, hooks);
    }
    hooks?.ready?.(pids);

    try {
      await s.run(sessions, { note: (text) => emit({ kind: "note", text }) });
    } catch (e: any) {
      // Append the transcript so far — a failing scenario is debugged from its own story.
      e.message += `\n\n--- transcript up to the failure ---\n${renderMarkdown({ events, pids })}`;
      throw e;
    }

    if (unconsumed.size > 0) {
      const left = [...unconsumed].map((p) => `[${p.session}] ${p.sql}`).join("; ");
      throw new Error(`scenario ended with unresolved blocked statements: ${left}`);
    }

    return { events, pids };
  } finally {
    // Cancel anything still running (e.g. a blocked statement in a failed scenario),
    // then drop the pool. PostgreSQL rolls back open transactions on disconnect.
    try {
      const canceller = connect(1);
      for (const pid of Object.values(pids)) {
        await canceller`SELECT pg_cancel_backend(${pid})`;
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
  emit: (e: Event) => void,
  unconsumed: Set<PendingImpl>,
  hooks?: RunHooks,
): Session {
  const call = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows> => {
    const text = renderSql(strings, values);
    await hooks?.before?.(name, text);
    try {
      const rows = (await conn(strings, ...values)) as Rows;
      emit({ kind: "query", session: name, sql: text, rows });
      return rows;
    } catch (raw: any) {
      const e = pgError(raw);
      emit({ kind: "error", session: name, sql: text, error: e });
      throw new Error(`[${name}] unexpected error (${e.code}) on: ${text}\n${e.message}`);
    }
  };

  call.fails = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<PgError> => {
    const text = renderSql(strings, values);
    await hooks?.before?.(name, text);
    try {
      await conn(strings, ...values);
    } catch (raw: any) {
      const e = pgError(raw);
      emit({ kind: "error", session: name, sql: text, error: e });
      return e;
    }
    throw new Error(`[${name}] expected an error, but statement succeeded: ${text}`);
  };

  call.blocked = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Pending> => {
    const text = renderSql(strings, values);
    await hooks?.before?.(name, text);
    const executing = conn(strings, ...values) as Promise<Rows>;
    executing.catch(() => {}); // consumed later via pending.success() / pending.failure()

    // The claim "this statement blocks" is itself verified: we poll pg_stat_activity
    // until the backend reports a Lock wait. If the statement completes instead, the
    // scenario fails — exactly what a false claim deserves.
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
      const [row] = await monitor`
        SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
      if (row?.wait_event_type === "Lock") break;
      if (Date.now() > deadline) {
        throw new Error(`[${name}] statement never blocked within ${BLOCK_DEADLINE_MS}ms: ${text}`);
      }
    }

    emit({ kind: "blocked", session: name, sql: text });
    const pending = new PendingImpl(name, text, executing, emit, unconsumed);
    unconsumed.add(pending);
    return pending;
  };

  return call;
}

class PendingImpl implements Pending {
  constructor(
    readonly session: string,
    readonly sql: string,
    private executing: Promise<Rows>,
    private emit: (e: Event) => void,
    private unconsumed: Set<PendingImpl>,
  ) {}

  success(): Promise<Rows> {
    this.unconsumed.delete(this);
    return this.executing.then(
      (rows) => {
        this.emit({ kind: "resume", session: this.session, rows });
        return rows;
      },
      (raw: any) => {
        const e = pgError(raw);
        this.emit({ kind: "resume-error", session: this.session, error: e });
        throw new Error(
          `[${this.session}] blocked statement failed unexpectedly (${e.code}): ${this.sql}\n${e.message}`,
        );
      },
    );
  }

  failure(): Promise<PgError> {
    this.unconsumed.delete(this);
    return this.executing.then(
      () => {
        throw new Error(
          `[${this.session}] expected blocked statement to fail, but it succeeded: ${this.sql}`,
        );
      },
      (raw: any) => {
        const e = pgError(raw);
        this.emit({ kind: "resume-error", session: this.session, error: e });
        return e;
      },
    );
  }
}

/** Bun puts the SQLSTATE in `errno`; move it to `code`, where scenarios expect it. */
function pgError(e: any): PgError {
  if (e?.errno) e.code = String(e.errno);
  return e;
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
  return lines.map((l) => l.slice(cut)).join("\n").trim();
}
