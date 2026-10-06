# Savepoints

A savepoint identifies a point within the current transaction. The
[PostgreSQL 18 ROLLBACK TO manual](https://www.postgresql.org/docs/18/sql-rollback-to.html#SQL-ROLLBACK-TO-DESCRIPTION)
documents that rollback to it discards later transactional changes without ending the transaction.
Savepoints are not independently committed nested transactions: surviving changes
remain part of the outer transaction.

## Recovering from an error mid-transaction

This Scenario establishes a savepoint before a uniqueness violation, rolls back to it,
then inserts a replacement row. The final SELECT asserts that the earlier INSERT and
the replacement both committed.

<!--@include: ./parts/savepoint-recovery.md-->

This is recovery from a statement error with a usable prior savepoint. It is not a
general substitute for [retrying a serialization failure](/postgres/05-patterns/retrying-serialization-failures)
with a fresh transaction, and it cannot restore a closed connection.

## Nesting and RELEASE

The Scenario rolls back to outer_sp, then asserts 3B001 when it tries inner_sp.
After recovering to outer_sp again, it inserts row 4 and releases the savepoint.
A subsequent rollback attempt asserts that outer_sp is gone; recovery through a newer
savepoint permits COMMIT. The final rows are 1 and 4.

<!--@include: ./parts/savepoint-nesting.md-->

The [ROLLBACK TO description](https://www.postgresql.org/docs/18/sql-rollback-to.html#SQL-ROLLBACK-TO-DESCRIPTION)
documents that later savepoints are destroyed and the target remains usable.
[RELEASE SAVEPOINT](https://www.postgresql.org/docs/18/sql-release-savepoint.html#SQL-RELEASE-SAVEPOINT-DESCRIPTION)
removes a savepoint and later savepoints without discarding their transactional changes; it does not commit.
The [subtransaction manual](https://www.postgresql.org/docs/18/subxacts.html) documents
increased storage I/O overhead beyond 64 open subxids (assigned nonvirtual subtransaction
IDs) per backend. Read-only subtransactions receive no subxid. A write assigns one
to the subtransaction and also assigns nonvirtual IDs to any ancestors that need them.
No performance measurement in these Scenarios establishes a workload-specific cost.

## Further reading

- [PostgreSQL 18: SAVEPOINT](https://www.postgresql.org/docs/18/sql-savepoint.html)
- [The same lesson on MySQL](/mysql/01-basics/savepoints)
