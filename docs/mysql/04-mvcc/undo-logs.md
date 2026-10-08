# Undo logs: where old row versions live

For MySQL 8.4 InnoDB, the [multi-versioning manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)
describes the clustered record's `DB_TRX_ID` and `DB_ROLL_PTR`. Undo records supply information
to reconstruct an earlier version. This differs from PostgreSQL's
[heap tuple history](/postgres/04-mvcc/row-versions); secondary indexes have their own behavior.
The physical mechanism is a Documented contract, not directly observed by the SELECTs below.

## Reading rows that no longer exist

At REPEATABLE READ, R establishes a read view before A deletes and commits all three rows.
A counts zero current rows, R still reads its original three, and R counts zero after
ending its transaction. Those visible results are the Demonstrated behavior.

<!--@include: ./parts/undo-logs.md-->

## DELETE is an UPDATE in disguise

The manual describes DELETE marking a record, with physical removal deferred until purge
can discard its update undo. The current query result being empty does not mean the physical
records or all undo have already disappeared. The transcript does not inspect physical pages.

Consistent nonlocking reads reconstruct a visible version without taking record locks.
That is not a promise that every reader and writer avoids waits: locking reads,
SERIALIZABLE, and [metadata locks](/mysql/03-locking/table-locks-and-ddl) have different rules.
Undo can remain needed by a read view or for rollback. Next:
[read views](/mysql/04-mvcc/read-views) and [purge](/mysql/04-mvcc/purge).

## Further reading

- [MySQL docs: Undo Logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-mvcc) records the exact manual support and execution limits for this lesson.
