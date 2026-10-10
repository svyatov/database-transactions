# Snapshots & the four levels

The [MySQL 8.4 isolation manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
documents four InnoDB levels, with REPEATABLE READ as the server default.
These lessons execute Scenarios on **MySQL 8.4.11 with InnoDB tables**. An
application or driver can override the default; inspect its connection settings.

A consistent nonlocking SELECT uses MVCC to read older committed versions instead
of waiting for a concurrent row writer. This is not a promise that SELECT never
waits: [metadata locks](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html)
can conflict with DDL, and locking SELECTs have different behavior.

The following table gives **Documented contracts**, not all-level executions.
It concerns concurrent changes to InnoDB tables; own writes remain visible.

| Level | Plain table SELECT visibility | Important boundary |
|---|---|---|
| READ UNCOMMITTED | May expose uncommitted versions; no consistent snapshot promise | A dirty value may be rolled back |
| READ COMMITTED | Fresh snapshot per consistent read | Separate SELECTs can disagree after a concurrent commit |
| REPEATABLE READ, default | Snapshot established by the first consistent read | Own writes are visible; UPDATE, DELETE and locking reads use current rows |
| SERIALIZABLE | Plain SELECTs lock in explicit transactions or with autocommit disabled | A standalone autocommit SELECT can use a nonlocking consistent read |

See [consistent reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
for own-write visibility and DML exceptions, and
[SERIALIZABLE](/mysql/02-isolation/serializable) for the executed autocommit distinction.
Do not mix the snapshot rule with a claim about every statement or every SQL function.

The [SET TRANSACTION contract](https://dev.mysql.com/doc/refman/8.4/en/set-transaction.html)
distinguishes a setting for the next transaction (`SET TRANSACTION`) from subsequent
session transactions (`SET SESSION TRANSACTION`). Set the next-transaction level
before starting it. MySQL does not use PostgreSQL's BEGIN ISOLATION LEVEL syntax.

## READ UNCOMMITTED means it

In this schedule B reads A's uncommitted 999, then reads 100 after A rolls back.
The 999 existed as uncommitted data, but never entered committed history.
No external application action is executed by this SELECT-result model.

<!--@include: ./parts/dirty-read.md-->

READ UNCOMMITTED permits dirty reads; it does not require every read to be dirty.
PostgreSQL instead maps that level to READ COMMITTED, as documented in its
[version 18 isolation manual](https://www.postgresql.org/docs/18/transaction-iso.html).
Continue with [READ COMMITTED](/mysql/02-isolation/read-committed),
[REPEATABLE READ](/mysql/02-isolation/repeatable-read),
[SERIALIZABLE](/mysql/02-isolation/serializable), and
[lost updates](/mysql/02-isolation/lost-update).

## Further reading

- [MySQL 8.4: Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [The same lesson on PostgreSQL](/postgres/02-isolation/snapshots-and-the-four-levels)
