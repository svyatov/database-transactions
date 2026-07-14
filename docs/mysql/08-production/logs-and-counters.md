# Logs and counters

The silent failures need counters; the loud ones need logs that actually capture them.
MySQL ships both, mostly off or easy to miss. This lesson turns on the right ones.

## Deadlocks: counted forever, logged if you ask

A deadlock error flashes by in one unlucky client's logs and is gone. The server,
however, counts:

<!--@include: ./parts/deadlock-counter.md-->

Two companions round out the counter. `SHOW ENGINE INNODB STATUS` keeps the full story of
the most recent deadlock (both transactions, both statements, both lock chains) under
its `LATEST DETECTED DEADLOCK` section, which makes it invaluable for diagnosing
[which two queries](/mysql/03-locking/deadlocks) are fighting and useless for counting,
since each new deadlock overwrites the last. When the counter starts climbing and you want
the full population rather than the latest sample, set `innodb_print_all_deadlocks = ON`
and MySQL writes that same report into the error log for every deadlock, not only the one
you happened to catch.

## The counters worth graphing

All from `information_schema.INNODB_METRICS` (or their `SHOW GLOBAL STATUS` cousins),
all proven meaningful by scenarios on this site:

| Counter | What it means | Proven by |
|---|---|---|
| `lock_deadlocks` | deadlocks since startup: rate, not level | [the scenario above](#deadlocks-counted-forever-logged-if-you-ask) |
| `lock_timeouts` | statements that hit `innodb_lock_wait_timeout` (`1205`) | [lock timeouts](/mysql/03-locking/nowait-skip-locked) |
| `trx_rseg_history_len` | purge backlog: an old read view somewhere | [history list health](/mysql/08-production/history-list-health) |
| `lock_row_lock_waits` / `lock_row_lock_time` | how often and how long writers queue | [lock queues](/mysql/03-locking/lock-queues) |

## The logs worth having

Two logs earn their keep for transaction work. The slow query log (`slow_query_log`,
`long_query_time`) is the classic, and it has one under-appreciated use: a query that spent
its time in a [lock wait](/mysql/03-locking/lock-queues) shows a long wall-clock time with
trivial examine counts, and that shape means "victim of a blocker", not "needs an index".
The error log is where deadlock reports land once `innodb_print_all_deadlocks = ON`, next
to the aborted connections and `wait_timeout` reaps from
[timeout guardrails](/mysql/08-production/long-and-idle-transactions).

What no counter here catches is the silent failure: a lost update or a write skew commits
cleanly and leaves every metric untouched, which is why those get caught in code rather
than on a graph. For everything loud, the counters suffice: alert on the rate of
`lock_deadlocks`, keep `LATEST DETECTED DEADLOCK` for the last one and
`innodb_print_all_deadlocks` for the full population, and read a slow-log row with big time
and tiny examine counts as a lock victim rather than a missing index.

## Further reading

- [MySQL docs: InnoDB INFORMATION_SCHEMA Metrics Table](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-metrics-table.html)
- [MySQL docs: The Slow Query Log](https://dev.mysql.com/doc/refman/8.4/en/slow-query-log.html)
- [The same lesson on PostgreSQL](/postgres/08-production/logs-and-counters)
