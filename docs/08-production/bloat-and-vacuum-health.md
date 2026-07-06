# Bloat & vacuum health

Chapter 4 showed the mechanism with a microscope —
[dead tuples](/04-mvcc/dead-tuples-and-bloat) on the page, [VACUUM](/04-mvcc/vacuum)
reclaiming them, [one old snapshot starving it all](/04-mvcc/long-transactions). This
lesson is the dashboard version: the same facts from `pg_stat_user_tables`, the view
your monitoring should already be scraping.

<<< ../../scenarios/08-production/vacuum-health.ts#demo{ts}

<!--@include: ./parts/vacuum-health.md-->

## Reading the dashboard

- `n_dead_tup` —
  ["Estimated number of dead rows"](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW).
  *Estimated* because it comes from the statistics system, not a table scan — cheap
  enough to poll every minute. Watch the **ratio** to `n_live_tup`: a queue table that's
  99% dead tuples explains its own slow scans. (When you need exact numbers, the
  [pgstattuple](https://www.postgresql.org/docs/current/pgstattuple.html) extension
  scans for real.)
- `last_vacuum` / `last_autovacuum` — when cleanup last ran, manually or via the
  daemon. A hot table whose `last_autovacuum` is days old is either configured wrong or
  — more often — blocked by [something holding the horizon](/04-mvcc/long-transactions).
  Cross-check with [detector 3](/08-production/long-and-idle-transactions).
- `age(datfrozenxid)` vs `autovacuum_freeze_max_age` — the
  [wraparound](/04-mvcc/wraparound) margin. The scenario renders it as a boolean on
  purpose: that's what your alert should be. When age crosses the threshold (200
  million by default), autovacuum goes into emergency mode whether you like it or not;
  alert at half that and you'll never meet the emergency.

## Key takeaways

- Poll `pg_stat_user_tables` for `n_dead_tup`/`n_live_tup` and `last_autovacuum` age on
  your busiest tables — bloat announces itself long before disk-full does.
- Vacuum that "stopped working" is almost never vacuum's fault: find the oldest
  transaction or an orphaned [prepared transaction](/06-distributed/two-phase-commit).
- Wraparound is a boolean alert, not a graph to admire:
  `age(datfrozenxid) < autovacuum_freeze_max_age / 2` or a human gets paged.

## Further reading

- [PostgreSQL docs: pg_stat_all_tables](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW)
- [PostgreSQL docs: routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) —
  including the wraparound section chapter 4 walked through
