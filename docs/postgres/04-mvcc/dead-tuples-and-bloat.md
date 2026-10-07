# Dead tuples and bloat

UPDATE creates a new tuple version and DELETE makes a version no longer live. Old versions are not necessarily removed immediately. Reusable space and obsolete versions can remain in the heap file; file growth depends on reuse, pruning, vacuum, fillfactor and workload, not just the number of writes. [Routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) documents the maintenance boundary.

## One row, four tuples

<!--@include: ./parts/dead-tuples-and-bloat.md-->

For counters, the asserted page contains four tuple versions after three updates, while the ordinary SELECT asserts one live value, 3. For bloat, the asserted heap size grows from five to nine 8 kB pages after updating all 1,000 rows. DELETE leaves zero live rows and nine pages at the next observation. These particular sizes are setup-dependent, not a universal doubling ratio or a promise that a file can never shrink.

## The same thing, at file scale

Standard VACUUM can make obsolete space reusable, and can truncate empty trailing pages when its locking conditions permit. [VACUUM FULL](/postgres/04-mvcc/vacuum) rewrites the table to compact it. The [long-transaction schedule](/postgres/04-mvcc/long-transactions) demonstrates an old snapshot preventing reclamation of the inspected versions, not the only possible cause of bloat.

[`pg_stat_user_tables.n_dead_tup`](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW) is an estimate, not an exact physical tuple count or a byte-size measurement. Combine it with file size and maintenance observations before diagnosing growth. No workload or performance benchmark is claimed here.

## Further reading

- [PostgreSQL 18: Recovering Disk Space](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [PostgreSQL 18: pageinspect](https://www.postgresql.org/docs/18/pageinspect.html)
- [The same lesson on MySQL](/mysql/04-mvcc/history-list-length)
