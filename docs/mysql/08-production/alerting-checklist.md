# Alerting checklist

Candidate signals for MySQL 8.4 InnoDB, not a complete incident detector. Set thresholds from workload baselines and service objectives. The linked schedules demonstrate selected mechanisms, not alert accuracy or production recovery time. Views require privileges and instrumentation; metrics require available, enabled counters and comparable sample intervals.

| # | Signal | Query source | Evidence and limit |
|---|---|---|---|
| 1 | Oldest transaction age | `min(trx_started)` in `information_schema.innodb_trx` | [Detector](/mysql/08-production/long-and-idle-transactions): transaction age, not read-view age |
| 2 | Idle connections with an InnoDB transaction | `innodb_trx` joined to processlist `command = 'Sleep'` | [Detector](/mysql/08-production/long-and-idle-transactions): one tagged idle reader |
| 3 | Current InnoDB row-lock waits | rows in `sys.innodb_lock_waits` | [Blocker diagnosis](/mysql/08-production/who-is-blocking-whom): one waiter; metadata waits need other views |
| 4 | Detected deadlock rate | comparable Δ `lock_deadlocks` samples | [Counter](/mysql/08-production/logs-and-counters): one asserted delta |
| 5 | InnoDB row-lock timeout rate | comparable Δ `lock_timeouts` samples | [Timeout](/mysql/03-locking/nowait-skip-locked): error asserted, metric delta not asserted |
| 6 | Sustained history-list growth | `trx_rseg_history_len` | [History health](/mysql/08-production/history-list-health): lower bound, not bytes or culprit proof |

Use the signals to select an investigation. An old idle transaction plus a growing history list is consistent with read-view retention, but does not identify the only cause. Check other readers, write load, and purge capacity before expecting cleanup. Short transaction ages do not prove hot-row contention; inspect the actual wait edges. Deadlock reports can guide [lock ordering](/mysql/03-locking/deadlocks) and [range-lock](/mysql/03-locking/gap-locks) investigation. Retries must respect the [application boundary](/mysql/05-patterns/retrying-deadlocks).

Timeouts without detected deadlocks do not prove an acyclic wait graph: [`innodb_deadlock_detect`](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html) can be disabled. The manual states: "At times, it may be more efficient to disable deadlock detection". In that configuration, lock wait timeouts resolve deadlocks. Check configuration and waits, not just counter correlations.

These metrics do not validate application invariants. The [lost-update and write-skew schedules](/mysql/02-isolation/anomaly-catalog) can commit without errors; use writer coordination and application-level invariant checks.

## Further reading

- [The same checklist for PostgreSQL](/postgres/08-production/alerting-checklist)
