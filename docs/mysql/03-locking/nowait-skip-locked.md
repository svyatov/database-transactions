# NOWAIT, lock timeouts, SKIP LOCKED

Waiting in a lock queue is the default, not the law. MySQL gives you three ways out: fail
instantly, give up after a deadline, or pretend locked rows don't exist.

## NOWAIT: fail fast

<!--@include: ./parts/nowait.md-->

## innodb_lock_wait_timeout: wait, but not forever

Every InnoDB lock wait is already bounded by `innodb_lock_wait_timeout` — 50 seconds by
default, settable per session (whole seconds only). When it fires you get errno `1205`, and —
easy to miss — it rolls back only the statement, not the transaction, which stays open and
keeps every lock it already holds:

<!--@include: ./parts/lock-timeout.md-->

::: warning 1205 ≠ 1213
A [deadlock (`1213`)](/mysql/03-locking/deadlocks) rolls back your whole transaction; a lock
timeout (`1205`) rolls back one statement. After `1205` your transaction is alive and still
holding locks — either retry the statement or `ROLLBACK`, but don't assume you're back at a
clean slate. (Set `innodb_rollback_on_timeout=ON` server-wide if you want `1205` to roll back
the whole transaction.)
:::

## SKIP LOCKED: the job-queue primitive

<!--@include: ./parts/skip-locked.md-->

Three exits from the queue, three shapes: `FOR UPDATE NOWAIT` fails instantly with errno
`3572`, `innodb_lock_wait_timeout` gives up after its deadline with `1205`, and
`FOR UPDATE SKIP LOCKED` pretends the locked rows aren't there. That last one reads a
deliberately inconsistent view — perfect for grabbing any free job, wrong for anything that
must see every row. PostgreSQL offers the same `NOWAIT` and `SKIP LOCKED` syntax but a
millisecond-granular `lock_timeout` and SQLSTATE `55P03`
([compare](/postgres/03-locking/nowait-skip-locked)). Row locks have been the whole story so
far; the lock that takes down migrations is a
[table-level one](/mysql/03-locking/table-locks-and-ddl).

## Further reading

- [MySQL docs: Locking Reads (NOWAIT, SKIP LOCKED)](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [MySQL docs: innodb_lock_wait_timeout](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout)
