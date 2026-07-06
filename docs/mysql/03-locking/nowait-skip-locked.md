# NOWAIT, lock timeouts, SKIP LOCKED

Waiting in a lock queue is the default, not the law. MySQL gives you three ways out: fail
instantly, give up after a deadline, or pretend locked rows don't exist.

## NOWAIT: fail fast

::: code-group
<<< ../../../scenarios/mysql/03-locking/nowait.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/03-locking/nowait.py#demo{py} [Python]
:::

<!--@include: ./parts/nowait.md-->

## innodb_lock_wait_timeout: wait, but not forever

Every InnoDB lock wait is already bounded by `innodb_lock_wait_timeout` — 50 seconds by
default, settable per session (whole seconds only). When it fires you get errno `1205`, and —
easy to miss — **only the statement is rolled back; the transaction stays open**, keeping
every lock it already holds:

::: code-group
<<< ../../../scenarios/mysql/03-locking/lock-timeout.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/03-locking/lock-timeout.py#demo{py} [Python]
:::

<!--@include: ./parts/lock-timeout.md-->

::: warning 1205 ≠ 1213
A [deadlock (1213)](/mysql/03-locking/deadlocks) rolls back your whole transaction; a lock
timeout (1205) rolls back one statement. After 1205 your transaction is alive and still
holding locks — either retry the statement or `ROLLBACK`, but don't assume you're back at a
clean slate. (Set `innodb_rollback_on_timeout=ON` server-wide if you want 1205 to roll back
the whole transaction.)
:::

## SKIP LOCKED: the job-queue primitive

::: code-group
<<< ../../../scenarios/mysql/03-locking/skip-locked.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/03-locking/skip-locked.py#demo{py} [Python]
:::

<!--@include: ./parts/skip-locked.md-->

## Key takeaways

- `FOR UPDATE NOWAIT` → errno `3572` immediately; `FOR UPDATE SKIP LOCKED` → locked rows
  vanish from the result; `innodb_lock_wait_timeout` → errno `1205` after the deadline.
- `SKIP LOCKED` reads an *inconsistent* view by design — perfect for "grab any free job",
  wrong for anything that must see all rows.
- PostgreSQL's equivalents: same `NOWAIT`/`SKIP LOCKED` syntax, but a millisecond-granular
  `lock_timeout` and SQLSTATE `55P03`
  ([compare](/postgres/03-locking/nowait-skip-locked)).

## Further reading

- [MySQL docs: Locking Reads (NOWAIT, SKIP LOCKED)](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [MySQL docs: innodb_lock_wait_timeout](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout)
