# The alerting checklist

Six numbers cover most transaction incidents on this site. Every one is queryable with
plain SQL, every mechanism behind them is proven by a scenario in the chapters above.

| # | Alert | Query source | Backed by |
|---|---|---|---|
| 1 | Oldest transaction age > minutes | `min(trx_started)` in `information_schema.innodb_trx` | [find-long-transactions](/mysql/08-production/long-and-idle-transactions) |
| 2 | Idle-in-transaction sessions > seconds | `innodb_trx` ⋈ processlist `command = 'Sleep'` | [find-long-transactions](/mysql/08-production/long-and-idle-transactions) |
| 3 | Lock waits now | rows in `sys.innodb_lock_waits` | [who-is-blocking-whom](/mysql/08-production/who-is-blocking-whom) |
| 4 | Deadlock rate | Δ `lock_deadlocks` (INNODB_METRICS) | [deadlock-counter](/mysql/08-production/logs-and-counters) |
| 5 | Lock-timeout rate | Δ `lock_timeouts` (INNODB_METRICS) | [lock timeouts](/mysql/03-locking/nowait-skip-locked) |
| 6 | Purge backlog sustained | `trx_rseg_history_len` (INNODB_METRICS) | [history-list-health](/mysql/08-production/history-list-health) |

Reading the board:

- **1, 2 and 6 fire together?** One forgotten transaction — alert 2's join names it;
  kill or fix the code path. The other alerts drain on their own.
- **3 spikes with 1 quiet?** Hot-row contention, not a stuck session: look at
  [lock queues](/mysql/03-locking/lock-queues) and whether a
  [SKIP LOCKED](/mysql/05-patterns/job-queue) or
  [atomic-update](/mysql/05-patterns/fixing-lost-updates) shape fits.
- **4 climbing steadily?** Check lock ordering first
  ([deadlock avoidance](/mysql/03-locking/deadlocks)), then
  [gap locks](/mysql/03-locking/gap-locks) if the statements involve ranges or inserts —
  and make sure every consumer has the [retry loop](/mysql/05-patterns/retrying-deadlocks).
- **5 without 4?** Waits are long but acyclic — usually one slow writer everyone queues
  behind; alert 3's view names it.

What's deliberately *not* here: anomaly detection for
[lost updates and write skew](/mysql/02-isolation/anomaly-catalog). No counter sees them —
they look like successful transactions. They're prevented by
[code patterns](/mysql/05-patterns/fixing-lost-updates), caught by application-level
invariant checks, and that's precisely why the patterns chapter exists.

## Further reading

- [The same checklist for PostgreSQL](/postgres/08-production/alerting-checklist)
