# Bloat & vacuum health

Chapter 4 showed the mechanism with a microscope —
[dead tuples](/postgres/04-mvcc/dead-tuples-and-bloat) on the page, [VACUUM](/postgres/04-mvcc/vacuum)
reclaiming them, [one old snapshot starving it all](/postgres/04-mvcc/long-transactions). This
lesson is the dashboard version: the same facts from `pg_stat_user_tables`, the view
your monitoring should already be scraping.

<!--@include: ./parts/vacuum-health.md-->

## Reading the dashboard

Start with `n_dead_tup`, the
["Estimated number of dead rows"](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW).
It's estimated because it comes from the statistics system rather than a table scan,
which is what keeps it cheap enough to poll every minute. Watch its ratio to `n_live_tup`
rather than the raw count: a queue table that's 99% dead tuples explains its own slow
scans. When you need exact numbers, the
[pgstattuple](https://www.postgresql.org/docs/current/pgstattuple.html) extension scans
for real.

`last_vacuum` and `last_autovacuum` tell you when cleanup last ran, manually or via the
daemon. A hot table whose `last_autovacuum` is days old is either configured wrong or,
more often, blocked by [something holding the
horizon](/postgres/04-mvcc/long-transactions) — cross-check with
[detector 3](/postgres/08-production/long-and-idle-transactions).

`age(datfrozenxid)` against `autovacuum_freeze_max_age` is the
[wraparound](/postgres/04-mvcc/wraparound) margin, and the scenario renders it as a
boolean on purpose because that's what your alert should be. Once the age reaches the
threshold (200 million transactions by default), PostgreSQL forces an anti-wraparound
autovacuum on the table, and it does so even if you've turned autovacuum off. Alert at
half that margin and you'll never meet the forced pass.

Poll `pg_stat_user_tables` for the dead-to-live ratio and the age of `last_autovacuum`
on your busiest tables, and bloat announces itself long before disk-full does. When
vacuum looks like it "stopped working," the fault is almost never vacuum's — it's the
oldest open transaction or an orphaned [prepared
transaction](/postgres/06-distributed/two-phase-commit) pinning the horizon. Wraparound
stays a boolean rather than a graph to admire: `age(datfrozenxid) <
autovacuum_freeze_max_age / 2`, or a human gets paged.

## Further reading

- [PostgreSQL docs: pg_stat_all_tables](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW)
- [PostgreSQL docs: routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) —
  including the wraparound section chapter 4 walked through
- [The same lesson on MySQL](/mysql/08-production/history-list-health)
