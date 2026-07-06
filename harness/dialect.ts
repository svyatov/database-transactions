/**
 * Everything database-specific in the harness, side by side. The engine (run.ts) and
 * renderer (transcript.ts) are dialect-agnostic; this file is where PostgreSQL and
 * MySQL actually differ — which is itself part of the learning material.
 */
import { SQL, type ReservedSQL } from "bun";
import type { DbError, Rows } from "./scenario";

export interface Dialect {
  name: "postgres" | "mysql";
  /** Product name and server version, for transcript footers. */
  product: string;
  version(sql: SQL): Promise<string>;
  /** A fresh connection pool. Each scenario gets its own so session-level SETs never leak. */
  connect(max: number): SQL;
  /** Wipe everything a previous scenario could have left behind. */
  reset(admin: ReservedSQL): Promise<void>;
  /** Prepare a named session and return its backend/connection id. */
  openSession(conn: ReservedSQL, name: string): Promise<number>;
  /** Is this backend currently waiting on a lock? The signal behind `.blocked`. */
  isBlocked(monitor: ReservedSQL, id: number): Promise<boolean>;
  /** Cancel the backend's running statement (not the connection). */
  cancel(admin: SQL, id: number): Promise<void>;
  /** Execute one scenario statement on a session connection. */
  exec(conn: ReservedSQL, strings: TemplateStringsArray, values: unknown[], text: string): Promise<Rows>;
  /** Normalize a driver error so scenarios can assert on `.code`. */
  toError(raw: any): DbError;
  /** Render an error the way the database's own CLI would. */
  errorLine(e: DbError): string;
  /** Render a zero-row result the way the database's own CLI would. */
  statusLine(rows: Rows, sql: string): string;
  /** Columns whose values are transaction ids → renumbered 1001, 1002, … */
  xidColumns: Set<string>;
  /** Columns whose values are backend/connection ids → pid(A), pid(B), … */
  idColumns: Set<string>;
}

export const postgres: Dialect = {
  name: "postgres",
  product: "PostgreSQL",

  async version(sql) {
    const [row] = await sql`SHOW server_version`;
    return String(row!.server_version).split(" ")[0]!;
  },

  connect(max) {
    const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54321/postgres";
    return new SQL({ url, max });
  },

  // Drop everything, including prepared transactions — they survive disconnects,
  // that's their whole point.
  async reset(admin) {
    for (const { gid } of await admin`SELECT gid FROM pg_prepared_xacts`) {
      await admin.unsafe(`ROLLBACK PREPARED '${String(gid).replace(/'/g, "''")}'`);
    }
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  },

  // application_name = session name, so monitoring queries (pg_stat_activity, pg_locks)
  // can identify sessions deterministically in transcripts.
  async openSession(conn, name) {
    const [row] = await conn`
      SELECT set_config('application_name', ${name}, false), pg_backend_pid() AS pid`;
    return row!.pid;
  },

  async isBlocked(monitor, id) {
    const [row] = await monitor`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${id}`;
    return row?.wait_event_type === "Lock";
  },

  async cancel(admin, id) {
    await admin`SELECT pg_cancel_backend(${id})`;
  },

  exec(conn, strings, values) {
    return conn(strings, ...values) as Promise<Rows>;
  },

  /** Bun puts the SQLSTATE in `errno`; move it to `code`, where scenarios expect it. */
  toError(e) {
    if (e?.errno) e.code = String(e.errno);
    return e;
  },

  errorLine: (e) => `ERROR:  ${e.code}: ${e.message}`,

  statusLine(rows) {
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
  },

  xidColumns: new Set(["xmin", "xmax", "t_xmin", "t_xmax", "xid", "backend_xid", "backend_xmin", "transactionid"]),
  idColumns: new Set(["pid", "pg_backend_pid", "pg_blocking_pids", "blocking_pids", "blocked_by"]),
};

export const mysql: Dialect = {
  name: "mysql",
  product: "MySQL",

  async version(sql) {
    const [row] = await sql`SELECT VERSION() AS v`;
    return String(row!.v);
  },

  connect(max) {
    const url = process.env.MYSQL_URL ?? "mysql://root:mysql@localhost:33061/app";
    return new SQL({ url, max });
  },

  // Recreate the whole database; fresh session connections pick `app` from the URL.
  async reset(admin) {
    await admin.unsafe("DROP DATABASE IF EXISTS app; CREATE DATABASE app; USE app;");
  },

  // No application_name equivalent — sessions are identified by connection id alone.
  // Monitoring scenarios must select id columns (normalized to pid(A)) rather than
  // filter by a literal id, which would be nondeterministic in transcripts.
  async openSession(conn, name) {
    const [row] = await conn`SELECT CONNECTION_ID() AS pid`;
    return row!.pid;
  },

  // Row-lock waits are visible in performance_schema.data_locks (live engine state);
  // DDL blocked on a metadata lock only in processlist. Do NOT poll
  // information_schema.innodb_trx for this: it is served from a cache that refreshes
  // only after 100ms of idle time — polling it faster than that reads stale data forever.
  async isBlocked(monitor, id) {
    const rows = await monitor`
      SELECT 1 FROM performance_schema.data_locks dl
        JOIN performance_schema.threads th ON th.thread_id = dl.thread_id
        WHERE th.processlist_id = ${id} AND dl.lock_status = 'WAITING'
      UNION ALL
      SELECT 1 FROM performance_schema.processlist
        WHERE id = ${id} AND state LIKE 'Waiting for%lock'`;
    return rows.length > 0;
  },

  async cancel(admin, id) {
    await admin.unsafe(`KILL QUERY ${Number(id)}`);
  },

  // MySQL's prepared-statement protocol rejects SET/BEGIN/USE (errno 1295), and tagged
  // templates always prepare — so parameterless statements take the text protocol.
  exec(conn, strings, values, text) {
    return (values.length ? conn(strings, ...values) : conn.unsafe(text)) as Promise<Rows>;
  },

  /** Scenarios assert MySQL error numbers — "1213" is what you grep for, not SQLSTATE. */
  toError(e) {
    if (e?.errno) e.code = String(e.errno);
    return e;
  },

  errorLine: (e) => `ERROR ${e.code} (${e.sqlState ?? "HY000"}): ${e.message}`,

  // The MySQL adapter doesn't populate rows.command — classify by the statement itself.
  // affectedRows counts *changed* rows on UPDATE (PostgreSQL counts matched — a lesson).
  statusLine(rows, sql) {
    if (/^\s*(SELECT|SHOW|TABLE|WITH)/i.test(sql)) return "Empty set";
    const n = rows.affectedRows;
    if (typeof n === "number" && /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) {
      return `Query OK, ${n} row${n === 1 ? "" : "s"} affected`;
    }
    return "Query OK";
  },

  xidColumns: new Set([
    "trx_id",
    "blocking_trx_id",
    "waiting_trx_id",
    "engine_transaction_id",
    "requesting_engine_transaction_id",
    "blocking_engine_transaction_id",
  ]),
  idColumns: new Set([
    "id",
    "processlist_id",
    "conn_id",
    "trx_mysql_thread_id",
    "waiting_pid",
    "blocking_pid",
  ]),
};

/** Scenario paths are namespaced by database: scenarios/<db>/<chapter>/<name>. */
export function dialectFor(file: string): Dialect {
  return file.startsWith("mysql/") ? mysql : postgres;
}
