# Who is blocking whom

This PostgreSQL 18.6 schedule has one idle blocker and one waiter. A holds a row lock after writing balance 200; B's conflicting update waits. The query combines `pg_stat_activity` with `pg_blocking_pids()` to identify them, then a permitted monitoring session terminates A.

<!--@include: ./parts/who-is-blocking-whom.md-->

## Reading the answer

The asserted result names B, A, both statements, and A's `idle in transaction` state. For an idle backend, `query` reports its last query; for an active backend, it reports the current one. The [activity-view contract](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) also limits other sessions' details by role. The demo uses superuser access; a production operator may need `pg_read_all_stats` or suitable privileges.

The [blocking-function contract](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION) includes conflicting holders and earlier conflicting waiters in a lock queue. Prepared transactions can appear as PID zero, so this inner join to live sessions cannot report every blocker. Parallel queries can produce duplicate client PIDs. Neither case is executed here; use [pg_locks](/postgres/03-locking/monitoring-locks) and [pg_prepared_xacts](/postgres/06-distributed/two-phase-commit) when a session join is incomplete. Restrict a production query to the relevant database and scope before acting.

PostgreSQL 18's [signaling contract](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL) says `pg_cancel_backend` "Cancels the current query" and `pg_terminate_backend` "Terminates the session". Cancellation has no running query to stop in this idle-blocker case. Ending the transaction from its application is another option; termination is not the only way to release its locks. Signaling requires permission. Only a superuser can cancel or terminate an ordinary superuser session. As a documented exception, roles with `pg_signal_autovacuum_worker` privileges can cancel or terminate autovacuum workers, which are otherwise considered superuser backends. This Scenario does not exercise that exception.

With the default zero timeout argument, a true termination result confirms signal delivery, not completed termination. The resumed B update supplies the completion observation here. M reads balance 100 while B's 300 is uncommitted, which checks that A's 200 did not commit. After B commits, M reads 300.

Operational advice: confirm the owner and business impact before terminating a backend. The [session-end contract](https://www.postgresql.org/docs/18/protocol-flow.html#PROTOCOL-FLOW-TERMINATION) rolls back an open transaction, but that can discard needed work and cannot reverse already completed external effects. This schedule does not establish that killing an arbitrary production blocker is safe.

## Further reading

- [PostgreSQL 18: Server Signaling Functions](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL)
- [PostgreSQL 18: pg_blocking_pids](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION)
- [The same lesson on MySQL](/mysql/08-production/who-is-blocking-whom)
