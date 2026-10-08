# Logs and counters

For MySQL 8.4 InnoDB, distinguish a measured counter delta from a retained incident log. The following schedule checks deadlock detection and metric enablement, raises `1213`, and asserts a server-wide `lock_deadlocks` increase of at least one.

## Deadlocks: a counter delta, not a permanent log {#deadlocks-counted-forever-logged-if-you-ask}

The counter is useful within an enabled collection interval, with restart and reset handled by your monitoring system.

<!--@include: ./parts/deadlock-counter.md-->

## The counters worth graphing

The [MySQL metrics manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-metrics-table.html#innodb-information-schema-metrics-table-counters) states: "Counter status is not persistent." Check available names, `STATUS`, enablement, and collection/reset times. Rates require successive samples in a comparable interval.

| Counter | Interpretation | Evidence boundary |
|---|---|---|
| `lock_deadlocks` | Detected deadlocks during collection | The schedule above asserts a delta, not log retention |
| `lock_timeouts` | InnoDB row-lock timeouts during collection | [Chapter 3](/mysql/03-locking/nowait-skip-locked) asserts `1205`, not this counter's delta |
| `trx_rseg_history_len` | History-list length, not bytes or a diagnosis | [History list health](/mysql/08-production/history-list-health) asserts a lower bound |
| `lock_row_lock_waits` / `lock_row_lock_time` | Row-lock wait count / accumulated time | Documented metric names; [lock queues](/mysql/03-locking/lock-queues) demonstrate waits, not these counters |

## The logs worth having

The [deadlock manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html) documents `SHOW ENGINE INNODB STATUS` for the latest deadlock and `innodb_print_all_deadlocks` for error-log reports. These are Documented contracts; this scenario does not inspect log destinations, permissions, or retention. Use retained reports to investigate actual lock order before selecting a repair.

The [slow-query-log manual](https://dev.mysql.com/doc/refman/8.4/en/slow-query-log.html) states: "By default, the slow query log is disabled." Its inclusion filters and output destination affect what you capture. High query time with few examined rows is a clue, not proof of a blocker or proof that an index is unnecessary. Confirm live waits through [the lock views](/mysql/08-production/who-is-blocking-whom). No slow-log record is asserted here.

Lost updates and write skew can commit without an error in the [anomaly schedules](/mysql/02-isolation/anomaly-catalog). These concurrency counters do not validate application invariants. Check those invariants and participating writers as well.

## Further reading

- [MySQL docs: InnoDB INFORMATION_SCHEMA Metrics Table](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-metrics-table.html)
- [MySQL docs: The Slow Query Log](https://dev.mysql.com/doc/refman/8.4/en/slow-query-log.html)
- [The same lesson on PostgreSQL](/postgres/08-production/logs-and-counters)
