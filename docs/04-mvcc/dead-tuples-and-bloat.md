# Dead tuples and bloat

If [nothing is ever modified in place](/04-mvcc/row-versions) and nothing is immediately
removed, an obvious question follows: **where does it all go?** Answer: nowhere. Old
versions — *dead tuples* — stay right in the table's file, and the file only ever grows.
That growth is **bloat**, and it's not a malfunction: it's the rent MVCC pays for
non-blocking reads.

## One row, four tuples

<<< ../../scenarios/04-mvcc/dead-tuples-and-bloat.ts#demo{ts}

<!--@include: ./parts/dead-tuples-and-bloat.md-->

Each update stamps the current version's `t_xmax`, writes a fresh copy one slot over, and
moves on. `SELECT` walks the chain and returns exactly one row; the page holds the row's
entire biography.

## The same thing, at file scale

<<< ../../scenarios/04-mvcc/dead-tuples-and-bloat.ts#size{ts}

Three facts worth reading twice:

- **An UPDATE of every row temporarily doubles the table.** A "harmless" backfill
  migration (`UPDATE users SET new_column = ...`) rewrites every tuple — plan for the
  disk, and for the [WAL and vacuum work](/04-mvcc/vacuum) that follows.
- **`DELETE` freed nothing.** Zero live rows, nine pages. The space isn't lost — VACUUM
  will make it reusable — but it is *not* returned to the operating system.
- The file never shrinks on its own. Which is exactly where the
  [next lesson](/04-mvcc/vacuum) picks up.

## Key takeaways

- Dead tuples are **normal**: a steady-state churn of them, continuously recycled by
  autovacuum, is MVCC working as designed. Bloat becomes a problem when dead tuples
  accumulate faster than vacuum reclaims them — the usual culprit is a
  [long-running transaction](/04-mvcc/long-transactions).
- Update-heavy tables live best with room to recycle: prefer many small transactions over
  giant `UPDATE`-everything sweeps, and let autovacuum keep pace.
- Watch `n_dead_tup` in
  [`pg_stat_user_tables`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW) —
  the production chapter will build monitoring on it.

## Further reading

- [PostgreSQL docs: Vacuuming Basics](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-BASICS)
- [PostgreSQL docs: pageinspect](https://www.postgresql.org/docs/current/pageinspect.html)
