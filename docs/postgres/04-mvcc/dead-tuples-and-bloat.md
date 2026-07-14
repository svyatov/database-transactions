# Dead tuples and bloat

If [nothing is ever modified in place](/postgres/04-mvcc/row-versions) and nothing is immediately
removed, an obvious question follows: where does it all go? Nowhere, is the honest answer. Old
versions (*dead tuples*) stay right in the table's file, and the file only ever grows. That
growth is bloat, and it isn't a malfunction: it's the rent MVCC pays for non-blocking reads.

## One row, four tuples

<!--@include: ./parts/dead-tuples-and-bloat.md-->

Each update stamps the current version's `t_xmax`, writes a fresh copy one slot over, and moves
on. `SELECT` walks the chain and returns exactly one row; the page holds the row's entire
biography.

## The same thing, at file scale

The same story plays out page by page, and three facts on it are worth reading twice. An UPDATE
of *every* row temporarily doubles the table, so a "harmless" backfill migration like
`UPDATE users SET new_column = ...` rewrites every tuple: plan for the disk, and for the
[WAL and vacuum work](/postgres/04-mvcc/vacuum) that follows. Then the `DELETE` frees nothing:
zero live rows, nine pages still on disk. That space isn't lost (VACUUM will make it reusable),
but it is not returned to the operating system. Which is the third fact: the file never shrinks on
its own, and that's exactly where the [next lesson](/postgres/04-mvcc/vacuum) picks up.

None of this is pathological. A steady-state churn of dead tuples, continuously recycled by
autovacuum, is MVCC working as designed. Bloat becomes a problem only when dead tuples accumulate
faster than vacuum can reclaim them, and the usual culprit is a
[long-running transaction](/postgres/04-mvcc/long-transactions) holding an old snapshot open. So
update-heavy tables live best with room to recycle: prefer many small transactions over giant
`UPDATE`-everything sweeps, and let autovacuum keep pace. To know whether it is keeping pace, watch
`n_dead_tup` in
[`pg_stat_user_tables`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW).
The production chapter builds monitoring on it.

## Further reading

- [PostgreSQL docs: Vacuuming Basics](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-BASICS)
- [PostgreSQL docs: pageinspect](https://www.postgresql.org/docs/current/pageinspect.html)
- [The same lesson on MySQL](/mysql/04-mvcc/history-list-length)
