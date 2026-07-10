/**
 * Loads a scenario from its canonical YAML form and interprets its steps
 * against the same Session API that code scenarios use — one statement per
 * step, interleaved across sessions in list order.
 *
 * A step is a map whose one non-reserved key names the session (with an
 * optional `.fails` verb suffix); the value is the SQL. Reserved keys:
 *
 *   note / sleep / locked / success / failure   — step types of their own
 *   expect / affected / error / comment / capture / blocks — modifiers
 *
 * `expect` rows are subset-matched: only the listed fields are compared.
 * `${name.field}` refers to a `capture`d row's field — in SQL text and in
 * expected values; `$pid(A)` in expected values resolves to that session's
 * backend id.
 */
import { eq, type Pending, type Row, type Rows, type Scenario, type Session, type Tools } from "./scenario";

type Step = Record<string, any>;

interface Doc {
  title: string;
  claim: string;
  setup: string;
  sessions: string[];
  steps: Step[];
  anomaly?: string;
  isolation?: string;
}

const RESERVED = new Set([
  "note",
  "sleep",
  "locked",
  "success",
  "failure",
  "expect",
  "affected",
  "error",
  "comment",
  "capture",
  "blocks",
  "tl",
]);
const REQUIRED = ["title", "claim", "setup", "sessions", "steps"] as const;

/** The Adya codes of /concepts/isolation-anomalies — the rows of the cross-engine matrix. */
const ANOMALIES = ["G0", "G1a", "G1b", "G1c", "OTV", "P2", "G-single", "PMP", "P4", "G2-item", "G2"];
const LEVELS = /ISOLATION LEVEL (READ UNCOMMITTED|READ COMMITTED|REPEATABLE READ|SERIALIZABLE)/gi;

/** Every error this loader raises names the file it came from. */
const failAt =
  (path: string) =>
  (msg: string): never => {
    throw new Error(`${path}: ${msg}`);
  };

/** Load any scenario file — `.ts` via its default export, `.yaml` via the interpreter. */
export async function loadScenario(absPath: string): Promise<Scenario> {
  if (!absPath.endsWith(".ts")) {
    return fromYaml(Bun.YAML.parse(await Bun.file(absPath).text()) as Doc, absPath);
  }
  const s: Scenario = (await import(absPath)).default;
  // Only re-read the source when there is a declaration to check against it.
  if (s.anomaly || s.isolation) {
    checkMeta(s, sqlOfTs(await Bun.file(absPath).text(), s.setup, s.sessions), absPath);
  }
  return s;
}

/**
 * `anomaly` and `isolation` are the only fields nobody proves by running the scenario, so
 * they are checked against the scenario's own SQL instead of taken on the author's word.
 * A scenario that declares neither is untouched.
 */
function checkMeta(s: Pick<Scenario, "anomaly" | "isolation">, sql: string, path: string) {
  const fail = failAt(path);
  if (s.anomaly && !ANOMALIES.includes(s.anomaly)) {
    fail(`unknown anomaly "${s.anomaly}" — expected one of ${ANOMALIES.join(", ")}`);
  }
  if (s.isolation) {
    const set = [...sql.matchAll(LEVELS)].map((m) => m[1]!.toUpperCase());
    if (!set.includes(s.isolation.toUpperCase())) {
      fail(
        `declares isolation "${s.isolation}", but its SQL sets ${set.length ? [...new Set(set)].join(", ") : "no level"}`,
      );
    }
  }
}

/** Every SQL string a YAML scenario runs — notes and comments excluded, so prose can't fake a claim. */
function sqlOf(doc: Doc): string {
  const steps = doc.steps.flatMap((step) =>
    Object.entries(step)
      .filter(([key]) => !RESERVED.has(key))
      .map(([, value]) => String(value)),
  );
  return [doc.setup, ...steps].join("\n");
}

/**
 * The same, for a code scenario: `setup`, plus the templates tagged with a session name —
 * `A`…``, `A.fails`…``, `A.blocked`…``. Scanning every backtick instead would let a
 * `t.note(`…`)` or a commented-out statement satisfy the check, which is the whole failure
 * this guard exists to prevent. Comments go first, so a session name inside one can't tag
 * anything. Text this misparses is text it drops, and dropping text can only make the check
 * reject a valid declaration — loudly — never accept an invalid one.
 */
function sqlOfTs(source: string, setup: string, sessions: readonly string[]): string {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const names = sessions.map((n) => n.replace(/[^\w$]/g, "")).filter(Boolean);
  if (!names.length) return setup;
  const tagged = new RegExp(`(?<![\\w$.])(?:${names.join("|")})(?:\\.\\w+)?\`([^\`]*)\``, "g");
  return [setup, ...[...code.matchAll(tagged)].map((m) => m[1]!)].join("\n");
}

export function fromYaml(doc: Doc, path: string): Scenario {
  const fail = failAt(path);
  for (const key of REQUIRED) if (!doc[key]) fail(`missing "${key}"`);
  checkMeta(doc, sqlOf(doc), path);

  return {
    title: doc.title,
    claim: doc.claim,
    setup: doc.setup,
    sessions: doc.sessions,
    ...(doc.anomaly ? { anomaly: doc.anomaly } : {}),
    ...(doc.isolation ? { isolation: doc.isolation } : {}),
    async run(sessions: Record<string, Session>, t: Tools) {
      const captures: Record<string, Row> = {};
      const pendings: Record<string, Pending> = {};

      const finish = async (rows: Rows | Promise<Rows>, step: Step) => {
        const result = await rows;
        if (step.expect !== undefined) matchRows(result, step.expect, t, captures, fail);
        if (step.affected !== undefined) {
          eq(result.affectedRows ?? result.count, step.affected, "affected rows");
        }
        if (step.capture) captures[step.capture] = result[0] ?? {};
      };

      for (const step of doc.steps) {
        if (
          (step.comment || step.tl) &&
          ["note", "sleep", "locked", "success", "failure"].some((k) => step[k] !== undefined)
        ) {
          fail(
            `a comment/tl here is never rendered — use a note, or put tl on the statement step (${JSON.stringify(step)})`,
          );
        }
        if (step.note !== undefined) {
          t.note(step.note);
        } else if (step.sleep !== undefined) {
          await Bun.sleep(step.sleep);
        } else if (step.locked !== undefined) {
          await t.locked(step.locked);
        } else if (step.success !== undefined) {
          const pending = pendings[step.success] ?? fail(`no blocked statement named "${step.success}"`);
          await finish(pending.success(), step);
        } else if (step.failure !== undefined) {
          const pending = pendings[step.failure] ?? fail(`no blocked statement named "${step.failure}"`);
          checkCode((await pending.failure()).code, step.error);
        } else {
          const keys = Object.keys(step).filter((k) => !RESERVED.has(k));
          if (keys.length !== 1) fail(`step must have exactly one session key, got: ${JSON.stringify(step)}`);
          const [name = "", verb] = keys[0]!.split(".");
          const session = sessions[name] ?? fail(`unknown session "${name}" in step ${JSON.stringify(step)}`);
          const sql = template(interpolate(String(step[keys[0]!]), captures, fail), step.comment, step.tl);

          if (verb === "fails") {
            checkCode((await session.fails(sql)).code, step.error);
          } else if (verb) {
            fail(`unknown verb "${verb}" in step ${JSON.stringify(step)}`);
          } else if (step.blocks) {
            pendings[step.blocks] = await session.blocked(sql);
          } else {
            await finish(session(sql), step);
          }
        }
      }
    },
  };
}

/**
 * `error:` accepts one code or a list — a list means any of them proves the claim
 * (drivers differ on connection kills: psycopg reports the server FATAL's SQLSTATE,
 * Bun.sql only notices the closed socket).
 */
function checkCode(code: string, want: unknown) {
  const accepted = (Array.isArray(want) ? want : [want]).map(String);
  if (!accepted.includes(code)) {
    throw new Error(`error code: expected ${accepted.join(" | ")}, got ${code}`);
  }
}

/**
 * A plain SQL string as the tagged-template call the Session API expects.
 * `tl` rides along as an own-property; the runner copies it onto the events
 * this statement emits (see renderTimeline).
 */
function template(sql: string, comment?: string, tl?: string): TemplateStringsArray {
  const text = comment ? `${sql} -- ${comment}` : sql;
  return Object.assign([text], {
    raw: [text],
    tl,
  }) as unknown as TemplateStringsArray;
}

/** Resolve `${name.field}` references to captured row fields. */
function interpolate(sql: string, captures: Record<string, Row>, fail: (m: string) => never): string {
  return sql.replace(/\$\{(\w+)\.(\w+)\}/g, (_, name, field) => {
    const row = captures[name] ?? fail(`no capture named "${name}"`);
    return String(row[field]);
  });
}

/** Subset row matching: rows must correspond 1:1, but only the listed fields are compared. */
function matchRows(actual: Rows, expected: Row[], t: Tools, captures: Record<string, Row>, fail: (m: string) => never) {
  eq(actual.length, expected.length, `expected ${expected.length} row(s), got ${actual.length}`);
  expected.forEach((exp, i) => {
    const act: Row = {};
    const want: Row = {};
    for (const [key, value] of Object.entries(exp)) {
      act[key] = plain(actual[i]![key]);
      const pid = typeof value === "string" && value.match(/^\$pid\((\w+)\)$/);
      const ref = typeof value === "string" && value.match(/^\$\{(\w+)\.(\w+)\}$/);
      want[key] = pid
        ? t.pid(pid[1]!)
        : ref
          ? plain((captures[ref[1]!] ?? fail(`no capture named "${ref[1]}"`))[ref[2]!])
          : value;
    }
    eq(act, want, `row ${i + 1}`);
  });
}

/** Bun.sql decodes int arrays as Int32Array on re-executed statements — compare as plain arrays. */
function plain(value: unknown): unknown {
  return ArrayBuffer.isView(value) ? Array.from(value as any) : value;
}
