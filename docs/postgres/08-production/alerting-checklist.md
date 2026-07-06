# Alerting checklist

Six numbers cover nearly every incident in this book. Each query below was proven in a
lesson; thresholds are starting points to tune, not laws.

| # | Alert when… | Query core | Proven in |
|---|---|---|---|
| 1 | A transaction is older than a few minutes | `max(now() - xact_start)` from `pg_stat_activity` | [Long & idle transactions](/postgres/08-production/long-and-idle-transactions) |
| 2 | Sessions sit `idle in transaction` for more than seconds | `count(*) WHERE state = 'idle in transaction' AND now() - state_change > '30 seconds'` | [Long & idle transactions](/postgres/08-production/long-and-idle-transactions) |
| 3 | More than a handful of sessions wait on locks | `count(*) WHERE wait_event_type = 'Lock'` | [Who is blocking whom](/postgres/08-production/who-is-blocking-whom) |
| 4 | The deadlock counter jumps | `deadlocks` from `pg_stat_database` (rate) | [Logs & counters](/postgres/08-production/logs-and-counters) |
| 5 | Dead tuples dominate a hot table, or autovacuum hasn't touched it lately | `n_dead_tup / greatest(n_live_tup, 1)`, `now() - last_autovacuum` | [Bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health) |
| 6 | Wraparound margin is half spent | `age(datfrozenxid) > autovacuum_freeze_max_age / 2` | [Bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health), [Wraparound](/postgres/04-mvcc/wraparound) |

Three notes on using the list:

- **Alerts 1–3 are the same incident at different ages.** One forgotten transaction
  becomes a lock queue becomes a full pool. Alert 1 fires first; treat it as the root.
- **Alert 4 is a rate, not a level.** The counter
  [never resets on its own](/postgres/08-production/logs-and-counters); a steady trickle of
  deadlocks under load can be normal for your workload — a step change isn't.
- **Don't forget the guardrails.** Every alert here has a matching timeout or setting
  that prevents the page instead of announcing it:
  [`statement_timeout` / `idle_in_transaction_session_timeout` / `transaction_timeout`](/postgres/08-production/long-and-idle-transactions),
  [`lock_timeout` for DDL](/postgres/03-locking/table-locks-and-ddl),
  [`log_lock_waits`](/postgres/08-production/logs-and-counters). An alert that fires often is a
  setting waiting to be set.
