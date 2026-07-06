import type { Event, RunResult } from "./run";
import type { Row, Rows } from "./scenario";

/**
 * Renders a scenario run as psql-flavored markdown.
 *
 * Values that vary between runs are normalized so committed transcripts diff cleanly:
 *  - transaction ids  → 1001, 1002, … in order of first appearance
 *  - backend pids     → pid(A), pid(B), …
 * Everything else must be deterministic by scenario convention (ORDER BY on multi-row
 * SELECTs, no timestamps, `::regclass` instead of raw oids).
 */
export function renderMarkdown(run: RunResult): string {
  const norm = new Normalizer(run.pids);
  const chunks: string[] = [];
  let fence: string[] = [];
  const flush = () => {
    if (fence.length) {
      chunks.push("```\n" + fence.join("\n").trimEnd() + "\n```");
      fence = [];
    }
  };

  for (const e of run.events) {
    if (e.kind === "note") {
      flush();
      chunks.push(`*${e.text}*`);
    } else {
      fence.push(renderEvent(e, norm), "");
    }
  }
  flush();
  return chunks.join("\n\n") + "\n";
}

/** Event-by-event renderer for live console replay (`bun lesson`). */
export function liveRenderer(pids: Record<string, number>): (e: Event) => string {
  const norm = new Normalizer(pids);
  return (e) => (e.kind === "note" ? `— ${e.text}` : renderEvent(e, norm)) + "\n";
}

function renderEvent(e: Exclude<Event, { kind: "note" }>, norm: Normalizer): string {
  switch (e.kind) {
    case "query":
      return `${prompt(e.session, e.sql)}\n${formatResult(e.rows, norm)}`;
    case "error":
      return `${prompt(e.session, e.sql)}\n${formatError(e.error)}`;
    case "blocked":
      return `${prompt(e.session, e.sql)}\n⏳ ${e.session} is waiting for a lock…`;
    case "resume":
      return `⏵ ${e.session} resumes:\n${formatResult(e.rows, norm)}`;
    case "resume-error":
      return `⏵ ${e.session}'s blocked statement fails:\n${formatError(e.error)}`;
  }
}

/** `A> SELECT …;` with continuation lines aligned under the statement. */
function prompt(session: string, sql: string): string {
  const [first = "", ...rest] = sql.split("\n");
  const lines = [`${session}> ${first}`, ...rest.map((l) => `${" ".repeat(session.length)}  ${l}`)];
  const text = lines.join("\n");
  // Append the ; psql would require — unless one is already there or a trailing comment is in the way.
  return /;\s*$/.test(text) || /--/.test(lines.at(-1)!) ? text : text + ";";
}

function formatError(error: { code: string; message: string }): string {
  return `ERROR:  ${error.code}: ${error.message}`;
}

function formatResult(rows: Rows, norm: Normalizer): string {
  if (rows.length > 0) return formatTable(rows, norm);
  switch (rows.command) {
    case "SELECT":
      return "(0 rows)";
    case "INSERT":
      return `INSERT 0 ${rows.count ?? 0}`;
    case "UPDATE":
    case "DELETE":
      return `${rows.command} ${rows.count ?? 0}`;
    default:
      return rows.command ?? "OK";
  }
}

function formatTable(rows: Row[], norm: Normalizer): string {
  const columns = Object.keys(rows[0]!);
  const cells = rows.map((row) => columns.map((c) => norm.cell(c, row[c])));
  const widths = columns.map((c, i) => Math.max(c.length, ...cells.map((r) => r[i]!.length)));
  const numeric = columns.map((_, i) => cells.every((r) => /^-?\d+(\.\d+)?$/.test(r[i]!) || r[i] === ""));

  const header = columns.map((c, i) => ` ${center(c, widths[i]!)} `).join("|");
  const divider = widths.map((w) => "-".repeat(w + 2)).join("+");
  const body = rows.map((_, r) =>
    columns
      .map((_, i) => ` ${numeric[i] ? cells[r]![i]!.padStart(widths[i]!) : cells[r]![i]!.padEnd(widths[i]!)} `)
      .join("|"),
  );
  const count = rows.length === 1 ? "(1 row)" : `(${rows.length} rows)`;
  return [header, divider, ...body, count].join("\n");
}

function center(text: string, width: number): string {
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

/** Column names whose values are transaction ids and must be remapped. */
const XID_COLUMNS = new Set([
  "xmin",
  "xmax",
  "t_xmin",
  "t_xmax",
  "xid",
  "backend_xid",
  "backend_xmin",
  "transactionid",
]);

const PID_COLUMNS = new Set(["pid", "pg_backend_pid", "pg_blocking_pids", "blocking_pids", "blocked_by"]);

class Normalizer {
  private xids = new Map<string, number>();
  private pidNames: Map<number, string>;

  constructor(pids: Record<string, number>) {
    this.pidNames = new Map(Object.entries(pids).map(([name, pid]) => [pid, name]));
  }

  cell(column: string, value: unknown): string {
    if (value === null || value === undefined) return "";
    // Bun.sql decodes int arrays as plain JS arrays on a statement's first execution,
    // but as Int32Array on re-executions (cached statement, binary protocol). Same thing.
    const arr = Array.isArray(value) ? value : ArrayBuffer.isView(value) ? Array.from(value as any) : null;
    if (XID_COLUMNS.has(column)) return String(this.xid(value));
    if (PID_COLUMNS.has(column)) {
      return arr ? `{${arr.map((v) => this.pid(v)).join(",")}}` : this.pid(value);
    }
    if (typeof value === "boolean") return value ? "t" : "f";
    if (arr) return `{${arr.join(",")}}`;
    return String(value);
  }

  private xid(value: unknown): number {
    const key = String(value);
    if (key === "0") return 0; // xmax = 0 means "never deleted/updated", not a real xid
    if (!this.xids.has(key)) this.xids.set(key, 1001 + this.xids.size);
    return this.xids.get(key)!;
  }

  private pid(value: unknown): string {
    const name = this.pidNames.get(Number(value));
    return name ? `pid(${name})` : String(value);
  }
}
