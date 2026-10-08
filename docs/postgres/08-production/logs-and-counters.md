# Logs and counters

PostgreSQL 18 offers cumulative statistics and configurable server logs for investigation. They have different retention and collection rules. This PostgreSQL 18.6 Scenario asserts one deadlock error and its counter delta; it does not assert server-log contents or successful application retry.

## The deadlock nobody saw

The [database-statistics contract](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-DATABASE-VIEW) describes `deadlocks` as "Number of deadlocks detected in this database".

<!--@include: ./parts/deadlock-counter.md-->

B receives `40P01` in the two-row cycle. After B rolls back and requests a statistics flush, M reads an asserted delta of one from the setup baseline. No retry wrapper or user-facing application runs here. The [retry lesson](/postgres/05-patterns/retrying-serialization-failures) executes a separate bounded retry example.

Documented scope: cumulative statistics can be reset explicitly and are reset after an unclean server shutdown. A clean shutdown preserves them. Track `stats_reset` and handle decreases or restarts when computing rates; neither resets nor restarts are exercised in this Scenario. Counter publication can lag, and the default cache lasts through the monitoring transaction. The forced flush is demonstration plumbing, not a production collection policy.

## What the server log says

Deadlock diagnostics can identify the participating statements and wait cycle. The error statement's inclusion depends on logging configuration such as `log_min_error_statement`; do not treat an illustrative excerpt as generated execution evidence. This lesson supplies no captured log artifact and makes no claim that CI checked log contents.

PostgreSQL 18's [logging contract](https://www.postgresql.org/docs/18/runtime-config-logging.html#GUC-LOG-LOCK-WAITS) provides two useful controls:

- `log_lock_waits`, off by default, logs qualifying waits longer than `deadlock_timeout`. Enable it with the required SET privilege and evaluate log volume. It reports waits; it does not prevent them or record every short wait.
- `log_min_duration_statement` logs qualifying completed statements. Their elapsed duration includes waiting time, but duration alone does not identify whether a lock or a slow plan caused it. Error logging is a separate setting.

Operational advice: correlate counters, activity views, and retained logs. A sampled activity query can miss a short-lived wait; configured wait logging can provide another observation. Neither a fixed sampling interval, a guaranteed capture rate, nor negligible logging overhead is measured here. Retries can hide some errors from users, but bounded retries can still fail and the counters are not a permanent history.

## Further reading

- [PostgreSQL 18: Cumulative Statistics](https://www.postgresql.org/docs/18/monitoring-stats.html)
- [PostgreSQL 18: Error Reporting and Logging](https://www.postgresql.org/docs/18/runtime-config-logging.html#GUC-LOG-LOCK-WAITS)
- [The same lesson on MySQL](/mysql/08-production/logs-and-counters)
