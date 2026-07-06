import { SQL } from "bun";

export const DB_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54321/postgres";

/** A fresh connection pool. Each scenario gets its own so session-level SETs never leak. */
export function connect(maxConnections: number): SQL {
  return new SQL({ url: DB_URL, max: maxConnections });
}
