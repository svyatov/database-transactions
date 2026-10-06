# NOWAIT, lock_timeout, SKIP LOCKED

These PostgreSQL 18 controls change different parts of lock waiting:

| Escape hatch | The question it answers |
|---|---|
| `NOWAIT` | Can this locking read acquire the required row locks without waiting? A conflicting row lock raises `55P03`. |
| `lock_timeout` | Has an individual lock acquisition waited longer than the configured nonzero limit? The demonstrated expiry raises `55P03`. |
| `SKIP LOCKED` | Which selected rows can this locking read lock now? Conflicting row locks are skipped. |

## NOWAIT: fail fast

<!--@include: ./parts/nowait.md-->

## lock_timeout: bounded patience

<!--@include: ./parts/lock-timeout.md-->

[`lock_timeout`](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-LOCK-TIMEOUT) applies separately to each acquisition, not to total statement time. If a shorter `statement_timeout` applies, it can fire first. Here B runs standalone statements, so its failed statement ends its implicit transaction. Inside an explicit transaction an error requires rollback or recovery through a previously established savepoint before ordinary commands can continue. Retry with fresh decisions only when the application permits it.

## SKIP LOCKED: the job-queue primitive

<!--@include: ./parts/skip-locked.md-->

The [SELECT contract](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE) scopes NOWAIT and SKIP LOCKED to row locks. The required table-level `ROW SHARE` lock is still acquired normally; other waits and errors remain possible. SKIP LOCKED does not itself raise `55P03` for a skipped row. It produces an inconsistent view suitable for queue-like consumers, not general reporting.

The workers' overlapping transactions are scheduled one after another, not dispatched simultaneously. They assert jobs 1, 2, 3 and then no available row. Explicit rollback releases A's lock, after which D asserts job 1 again. This establishes database-local row availability, not process-crash testing, fairness, duplicate-free external execution, or universal no-wait behavior. The [worker-queue lesson](/postgres/05-patterns/job-queue) builds on this boundary.

## Further reading

- [PostgreSQL 18: SELECT locking clause](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [PostgreSQL 18: lock_timeout](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-LOCK-TIMEOUT)
- [The same lesson on MySQL](/mysql/03-locking/nowait-skip-locked)
