# Logs and counters

The silent failures need counters; the loud ones need logs that actually capture them.
MySQL ships both — mostly off or easy to miss. This lesson turns on the right ones.

## Deadlocks: counted forever, logged if you ask

A deadlock error flashes by in one unlucky client's logs and is gone. The server,
however, counts:

<!--@include: ./parts/deadlock-counter.md-->

Two companions to the counter:

- `SHOW ENGINE INNODB STATUS` keeps the *full story of the most recent deadlock* — both
  transactions, both statements, both lock chains — under `LATEST DETECTED DEADLOCK`.
  Invaluable for diagnosing [which two queries](/mysql/03-locking/deadlocks) are fighting;
  useless for counting, since each deadlock overwrites the last.
- `innodb_print_all_deadlocks = ON` writes that same report for *every* deadlock into
  the error log — turn it on when the counter starts climbing and you need the full
  population, not the latest sample.

## The counters worth graphing

All from `information_schema.INNODB_METRICS` (or their `SHOW GLOBAL STATUS` cousins),
all proven meaningful by scenarios on this site:

| Counter | What it means | Proven by |
|---|---|---|
| `lock_deadlocks` | deadlocks since startup — rate, not level | [the scenario above](#deadlocks-counted-forever-logged-if-you-ask) |
| `lock_timeouts` | statements that hit `innodb_lock_wait_timeout` (`1205`) | [lock timeouts](/mysql/03-locking/nowait-skip-locked) |
| `trx_rseg_history_len` | purge backlog — an old read view somewhere | [history list health](/mysql/08-production/history-list-health) |
| `lock_row_lock_waits` / `lock_row_lock_time` | how often and how long writers queue | [lock queues](/mysql/03-locking/lock-queues) |

## The logs worth having

- **The slow query log** (`slow_query_log`, `long_query_time`) — the classic. One
  under-appreciated transaction use: a query that spent its time in a
  [lock wait](/mysql/03-locking/lock-queues) shows a long wall-clock time with trivial
  examine counts — that shape means "victim of a blocker", not "needs an index".
- **The error log** gets deadlock reports only with `innodb_print_all_deadlocks = ON`;
  aborted connections and `wait_timeout` reaps land there too
  ([timeout guardrails](/mysql/08-production/long-and-idle-transactions)).

## Key takeaways

- `lock_deadlocks` is monotonic: alert on its rate. `LATEST DETECTED DEADLOCK` explains
  the most recent one; `innodb_print_all_deadlocks` logs them all.
- Four INNODB_METRICS counters cover the transaction failure modes: deadlocks, lock
  timeouts, purge backlog, lock waiting.
- Slow-log entries with big time and tiny row counts are lock victims — triage the
  blocker, not the query plan.

## Further reading

- [MySQL docs: InnoDB INFORMATION_SCHEMA Metrics Table](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-metrics-table.html)
- [MySQL docs: The Slow Query Log](https://dev.mysql.com/doc/refman/8.4/en/slow-query-log.html)
- [The same lesson on PostgreSQL](/postgres/08-production/logs-and-counters)
