# Bloat & vacuum health

This PostgreSQL 18.6 Scenario observes estimated table statistics before and after manual VACUUM. It does not measure production scan speed, free bytes, autovacuum scheduling, or wraparound prevention. Compare it with the [page-level tuple lesson](/postgres/04-mvcc/dead-tuples-and-bloat) and the [queue's occupied-slot measurements](/postgres/07-pitfalls/queue-bloat).

<!--@include: ./parts/vacuum-health.md-->

## Reading the dashboard

The [statistics manual](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW) defines `n_dead_tup` as "Estimated number of dead rows". Here the forced statistics flush is followed by asserted estimates of five live and three dead rows. After manual VACUUM the view reports five live, zero dead, and a non-null `last_vacuum`. Estimates are not exact heap counts, and accumulated statistics can lag or remain cached within a monitoring transaction.

`last_vacuum` records manual vacuum activity; `last_autovacuum` records automatic activity. Neither timestamp proves that every old version was removable. This run checks the manual field only. An old automatic timestamp can reflect workload thresholds, configuration, scheduling, or lock interference; a retained horizon can limit removal even when vacuum runs. A timestamp alone does not identify the cause.

Documented scope: PostgreSQL 18's [freeze policy](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND) uses per-table `relfrozenxid`; database `datfrozenxid` is the minimum across tables. `autovacuum_freeze_max_age` is a launch threshold, 200 million by default, not the actual xid-wraparound boundary. Anti-wraparound vacuum can be invoked even with ordinary autovacuum disabled. Starting it does not prove completion.

The Scenario asserts only that the current database age is below that configured threshold. Alerting at half the threshold is an example policy, not an engine guarantee or proof that forced vacuum can never occur. Track age trends and table-level ages too; a boolean alone does not show how rapidly the remaining margin is consumed. No threshold crossing or xid exhaustion is executed.

Operational advice: use dead/live estimates, vacuum timestamps, table sizes, and workload trends as investigation signals, not a guaranteed scan-performance diagnosis. Check [old transactions](/postgres/08-production/long-and-idle-transactions), [prepared work](/postgres/06-distributed/two-phase-commit), and replication-slot horizons when removal is constrained. These are candidates, not a claim that vacuum tuning is never needed. The [pgstattuple extension](https://www.postgresql.org/docs/18/pgstattuple.html) can inspect a relation for more detailed tuple and free-space statistics, with scan cost and concurrent-activity limits; it is not executed here.

## Further reading

- [PostgreSQL 18: Table Statistics](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW)
- [PostgreSQL 18: Routine Vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
- [The same lesson on MySQL](/mysql/08-production/history-list-health)
