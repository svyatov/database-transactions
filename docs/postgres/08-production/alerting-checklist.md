# Alerting checklist

These PostgreSQL 18 signals are operational starting points, not measured coverage of all incidents. The linked Scenarios demonstrate individual fields and schedules. The aggregations, sampling intervals, and example thresholds below are recommendations, not executed alerting rules or engine guarantees.

| # | Signal to investigate | Query core or example policy | Evidence and limits |
|---|---|---|---|
| 1 | Old open transactions | `max(now() - xact_start)` from `pg_stat_activity`, filtered to relevant sessions | [Long & idle transactions](/postgres/08-production/long-and-idle-transactions) demonstrates age over one second, not a universal maximum-age limit. |
| 2 | Idle transactions | `count(*) WHERE state = 'idle in transaction' AND now() - state_change > interval '30 seconds'` | The [same lesson](/postgres/08-production/long-and-idle-transactions) uses one second. Thirty seconds is a tunable example. |
| 3 | Lock waiters | `count(*) WHERE wait_event_type = 'Lock'` | [Who is blocking whom](/postgres/08-production/who-is-blocking-whom) demonstrates one row-lock waiter; count alone does not identify a root cause. |
| 4 | Increasing deadlock rate | Changes in `pg_stat_database.deadlocks` over collection time | [Logs & counters](/postgres/08-production/logs-and-counters) asserts a delta of one. Handle counter resets and collection gaps. |
| 5 | Rising dead-row estimates or old vacuum timestamps | `n_dead_tup / greatest(n_live_tup, 1)::numeric`, `now() - last_autovacuum` | [Vacuum health](/postgres/08-production/bloat-and-vacuum-health) demonstrates manual vacuum and estimates. Use numeric division, handle null timestamps, and investigate rather than diagnose from the ratio alone. |
| 6 | Rising xid age | Example warning at `age(datfrozenxid) > current_setting('autovacuum_freeze_max_age')::int / 2` | [Vacuum health](/postgres/08-production/bloat-and-vacuum-health) checks below the full launch threshold. Half is advice, not the wraparound boundary or a prevention guarantee. |

Signals 1 through 3 can occur together, but a transaction need not hold a conflicting lock and a lock queue need not originate in an idle transaction. A full application pool is not measured by these database examples. Investigate the actual waits and application connection use before assigning a common cause.

Choose warning levels from workload needs, growth rates, monitoring privileges, and response time. A stale `last_autovacuum` value does not mean vacuum never ran, and a fresh one does not prove all cleanup succeeded. Counter rates need reset handling; xid age benefits from a trend and table-level investigation as well as a warning threshold.

The [timeout controls](/postgres/08-production/long-and-idle-transactions) and [DDL lock timeout](/postgres/03-locking/table-locks-and-ddl) can bound specific work or waits at the cost of errors or terminated sessions. [Lock-wait logging](/postgres/08-production/logs-and-counters) supplies diagnostics, not prevention. None of these settings guarantees an alert will not fire.

## Further reading

- [The same checklist for MySQL](/mysql/08-production/alerting-checklist)
