# Deadlocks

Two transactions can each hold a lock the other needs. With MySQL 8.4 InnoDB's default
`innodb_deadlock_detect=ON`, detection breaks a detected cycle by rolling back a victim.
It does not wait for the row-lock timeout. The
[manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html) documents the setting,
detection limits, and exceptions involving other engines or MySQL table locks.

## The classic: opposite lock order

<!--@include: ./parts/deadlock.md-->

Here B receives `1213` (SQLSTATE `40001`), and the final balances prove B's earlier debit
was undone. The entire transaction rolled back. If the operation is still required,
retry it from the start, including its reads; apply a bounded retry policy.
The victim is not an application choice: InnoDB tries to select a small transaction,
measured by rows inserted, updated, or deleted, rather than promising a particular victim.

## The cure: consistent lock order

<!--@include: ./parts/deadlock-avoidance.md-->

Both transfers acquire the two primary-key rows in the same order before changing them.
In this schedule B waits and both transfers commit. Consistent acquisition order reduces
cycles among those participating writers; this demonstration does not prove that arbitrary
queries, other indexes, foreign-key checks, or metadata locks cannot deadlock.

The [handling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
describes `SHOW ENGINE INNODB STATUS` for the latest deadlock and
`innodb_print_all_deadlocks=ON` for logging detected deadlocks. These diagnostics are
Documented contracts, not assertions in the two transcripts.
If a wait is not a detected deadlock, [identify its blocker](/mysql/03-locking/monitoring-locks).

## Further reading

- [MySQL docs: InnoDB Error Handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)
- [The PostgreSQL counterpart](/postgres/03-locking/deadlocks)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
