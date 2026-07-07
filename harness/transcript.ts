import type { Dialect } from "./dialect";
import type { Event, RunResult } from "./run";
import type { Row, Rows } from "./scenario";

/**
 * Renders a scenario run as CLI-flavored markdown.
 *
 * Values that vary between runs are normalized so committed transcripts diff cleanly:
 *  - transaction ids  → 1001, 1002, … in order of first appearance
 *  - backend ids      → pid(A), pid(B), …
 * Which columns hold those values is dialect-specific. Everything else must be
 * deterministic by scenario convention (ORDER BY on multi-row SELECTs, no timestamps,
 * `::regclass` instead of raw oids).
 */
export function renderMarkdown(run: RunResult, dialect: Dialect): string {
  const norm = new Normalizer(run.pids, dialect);
  const chunks: string[] = [];
  let fence: string[] = [];
  const flush = () => {
    if (fence.length) {
      chunks.push(`\`\`\`transcript\n${fence.join("\n").trimEnd()}\n\`\`\``);
      fence = [];
    }
  };

  for (const e of run.events) {
    if (e.kind === "note") {
      flush();
      chunks.push(`*${e.text}*`);
    } else {
      fence.push(renderEvent(e, norm, dialect), "");
    }
  }
  flush();
  return `${chunks.join("\n\n")}\n`;
}

/** Event-by-event renderer for live console replay (`bun lesson`). */
export function liveRenderer(pids: Record<string, number>, dialect: Dialect): (e: Event) => string {
  const norm = new Normalizer(pids, dialect);
  return (e) => `${e.kind === "note" ? `— ${e.text}` : renderEvent(e, norm, dialect)}\n`;
}

function renderEvent(e: Exclude<Event, { kind: "note" }>, norm: Normalizer, dialect: Dialect): string {
  switch (e.kind) {
    case "query":
      return `${prompt(e.session, e.sql)}\n${formatResult(e.rows, e.sql, norm, dialect)}`;
    case "error":
      return `${prompt(e.session, e.sql)}\n${dialect.errorLine(e.error)}`;
    case "blocked":
      return `${prompt(e.session, e.sql)}\n⏳ ${e.session} is waiting for a lock…`;
    case "resume":
      return `⏵ ${e.session} resumes:\n${formatResult(e.rows, e.sql, norm, dialect)}`;
    case "resume-error":
      return `⏵ ${e.session}'s blocked statement fails:\n${dialect.errorLine(e.error)}`;
  }
}

/** `A> SELECT …;` with continuation lines aligned under the statement. */
function prompt(session: string, sql: string): string {
  const [first = "", ...rest] = sql.split("\n");
  const lines = [`${session}> ${first}`, ...rest.map((l) => `${" ".repeat(session.length)}  ${l}`)];
  // A trailing `-- comment` sits after the ; the CLI would require: `COMMIT; -- why`.
  const comment = lines.at(-1)!.match(/^(.*\S)(\s+--.*)$/);
  if (comment && !/;$/.test(comment[1]!)) lines[lines.length - 1] = `${comment[1]};${comment[2]}`;
  const text = lines.join("\n");
  return /;\s*$/.test(text) || /--/.test(lines.at(-1)!) ? text : `${text};`;
}

function formatResult(rows: Rows, sql: string, norm: Normalizer, dialect: Dialect): string {
  return rows.length > 0 ? formatTable(rows, norm) : dialect.statusLine(rows, sql);
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

class Normalizer {
  private xids = new Map<string, number>();
  private pidNames: Map<number, string>;

  constructor(
    pids: Record<string, number>,
    private dialect: Dialect,
  ) {
    this.pidNames = new Map(Object.entries(pids).map(([name, pid]) => [pid, name]));
  }

  cell(column: string, value: unknown): string {
    if (value === null || value === undefined) return "";
    // Bun.sql decodes int arrays as plain JS arrays on a statement's first execution,
    // but as Int32Array on re-executions (cached statement, binary protocol). Same thing.
    const arr = Array.isArray(value) ? value : ArrayBuffer.isView(value) ? Array.from(value as any) : null;
    if (this.dialect.xidColumns.has(column)) return String(this.xid(value));
    if (this.dialect.idColumns.has(column)) {
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
