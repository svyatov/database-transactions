# Symptom triage

For MySQL 8.4 InnoDB, these symptoms suggest investigations, not unique diagnoses. The linked schedules reproduce selected mechanisms under their stated configuration. Confirm the cause before changing isolation, ending a connection, or retrying work.

| Symptom | First check | Possible mechanism | Scoped response |
|---|---|---|---|
| Updates wait, then finish | [Waiter/blocker views](/mysql/08-production/who-is-blocking-whom) | [Row-lock waits](/mysql/03-locking/lock-queues) | Shorten the holding transaction; end it only after checking rollback and client effects |
| Errno `1205` | Row-lock views and metadata-lock state | [Row-lock timeout](/mysql/03-locking/nowait-skip-locked) or [metadata timeout](/mysql/03-locking/table-locks-and-ddl) | For whole-operation retry, ROLLBACK first; check `innodb_rollback_on_timeout` |
| Errno `1213` | [Deadlock reports and counter](/mysql/08-production/logs-and-counters) | [Opposite order](/mysql/03-locking/deadlocks) or another lock cycle | Retry the rolled-back transaction within a safe application boundary; investigate actual locks |
| INSERT waits without a duplicate row | `data_locks` and wait edges | [Gap/range locks](/mysql/03-locking/gap-locks) | Narrow locking reads; READ COMMITTED changes range protection and retains constraint-related gap locks |
| Wrong numbers with successful commits | [Anomaly catalog](/mysql/02-isolation/anomaly-catalog) and application invariants | [Lost updates](/mysql/02-isolation/lost-update) or [write skew](/mysql/02-isolation/serializable) | Select a repair for the actual rule; single-row repairs alone do not protect every cross-row invariant |
| Storage growth | [History health](/mysql/08-production/history-list-health) and workload | Retained undo, insufficient purge capacity, or other storage growth | Investigate retaining views and purge; this metric does not measure disk bytes |
| DDL waits and later queries queue | processlist and metadata-lock state | [Metadata-lock queue](/mysql/03-locking/table-locks-and-ddl) | Bound metadata acquisition with `lock_wait_timeout`; investigate holders |

The [InnoDB error-handling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html) states: "A transaction deadlock causes InnoDB to roll back the entire transaction." For an InnoDB row-lock timeout, statement-only rollback is the default, `innodb_rollback_on_timeout=OFF`; ON requests transaction rollback. The [timeout schedule](/mysql/03-locking/nowait-skip-locked) asserts the OFF case. Do not infer identical rollback scope from identical error numbers in different operations.

Successful commits do not establish a valid application invariant. Concurrency counters can expose waits and purge history; they do not detect the business-rule violations shown in the anomaly catalog. Application checks and coordinated writer protocols are separate work.

## Further reading

- [The same triage for PostgreSQL](/postgres/08-production/symptom-triage)
