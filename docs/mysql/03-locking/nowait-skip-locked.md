# NOWAIT, lock timeouts, SKIP LOCKED

MySQL 8.4 InnoDB offers different responses to row-lock contention. These controls do not
bound every kind of wait a query can encounter.

## NOWAIT: fail fast

The existing primary-key row is locked by A. B's locking read returns `3572`, then succeeds
after A commits.

<!--@include: ./parts/nowait.md-->

## innodb_lock_wait_timeout: wait, but not forever

The [variable contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout)
sets an InnoDB row-lock timeout in whole seconds, with a default of 50. It does not govern
metadata locks. With `innodb_rollback_on_timeout=OFF` (the default), `1205` rolls back the
statement, not the whole explicit transaction.

<!--@include: ./parts/lock-timeout.md-->

::: warning 1205 ≠ 1213
The transcript checks the OFF setting and shows B's earlier update and its lock surviving
`1205`. B's explicit ROLLBACK undoes that update and releases C. A detected
[deadlock (`1213`)](/mysql/03-locking/deadlocks) rolls back the whole transaction.
Starting the server with `innodb_rollback_on_timeout=ON` changes the timeout rollback scope;
that configuration is documented, not exercised here.
:::

Decide whether the still-open transaction remains valid before retrying a statement.
ROLLBACK and restart when its earlier decisions must be reconsidered.

## SKIP LOCKED: the job-queue primitive

The workers acquire different available rows in this schedule. D initially sees no
available row even though jobs still exist; after A's explicit rollback, D can select job 1.
No worker crash or external job execution is tested.

<!--@include: ./parts/skip-locked.md-->

The [locking-read contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html#innodb-locking-reads-nowait-skip-locked)
limits NOWAIT and SKIP LOCKED to row-level locks. SKIP LOCKED omits locked rows and gives an
inconsistent view, useful for some queue policies, not a complete view or a delivery guarantee.
Both options are unsafe for statement-based replication. They can still encounter
[metadata-lock waits](/mysql/03-locking/table-locks-and-ddl).

## Further reading

- [The PostgreSQL counterpart](/postgres/03-locking/nowait-skip-locked)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
