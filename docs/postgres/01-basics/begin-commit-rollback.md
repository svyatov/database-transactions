# BEGIN, COMMIT, ROLLBACK

The [PostgreSQL 18 transaction tutorial](https://www.postgresql.org/docs/18/tutorial-transactions.html)
documents implicit transactions: without an explicit transaction block, a successful
individual statement commits its transaction. A client can issue BEGIN automatically;
inspect the SQL sent by your driver before assuming autocommit. These Scenarios send
one statement per request. Multiple statements in a single simple-query message can
share an implicit transaction, as the [protocol manual](https://www.postgresql.org/docs/18/protocol-flow.html#PROTOCOL-FLOW-MULTI-STATEMENT)
documents.

BEGIN keeps a transaction open for multiple statements. COMMIT makes its transactional
changes committed; ROLLBACK discards them. Visibility to a later reader depends on that
reader's isolation level and snapshot, not just on whether the writer has committed.

## Autocommit and visibility, demonstrated

B uses plain SELECTs at the pinned server default, READ COMMITTED. Its next SELECT sees
A's successful autocommit UPDATE, excludes A's later uncommitted UPDATE, then sees that
UPDATE after COMMIT. A division-by-zero error outside a transaction block is followed
by a successful new statement.

<!--@include: ./parts/autocommit-visibility.md-->

## One error poisons the whole transaction

In an explicit transaction, the demonstrated division-by-zero error leaves the transaction
failed. A subsequent ordinary SELECT returns SQLSTATE 25P02. This heading concerns that
statement-error case, not every kind of connection or transaction failure.

<!--@include: ./parts/aborted-transaction.md-->

Full ROLLBACK ends the failed transaction. A prior savepoint permits
[ROLLBACK TO SAVEPOINT](/postgres/01-basics/savepoints) after a recoverable statement error.
The second transaction above executes COMMIT after an error and asserts that its
earlier INSERT was rolled back. These recovery
commands are exceptions to the rejection of ordinary statements. A closed connection
requires a new connection; a serialization failure requires reconsidering the whole
transaction in a fresh attempt, not just rerunning the failed statement.

## ROLLBACK undoes DDL too

This migration inserts a row, builds a non-concurrent index, creates a table, then
encounters an asserted uniqueness violation. No implicit commit occurs along the way:
B still counts zero orders and cannot resolve the uncommitted table. After ROLLBACK,
B asserts that the row, table, and index are absent.

<!--@include: ./parts/ddl-rollback.md-->

This demonstrates the listed operations, not every schema command. The
[CREATE INDEX manual, Building Indexes Concurrently](https://www.postgresql.org/docs/18/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
documents that a regular index build can run inside a transaction block, while
CREATE INDEX CONCURRENTLY cannot. Other commands have their own restrictions; a
migration must check each command's manual and its external effects before claiming
all-or-nothing execution. The [MySQL lesson](/mysql/05-patterns/orm-pitfalls) demonstrates
that non-concurrent CREATE INDEX commits the preceding INSERT on MySQL 8.4.11.

## Further reading

- [PostgreSQL 18: BEGIN](https://www.postgresql.org/docs/18/sql-begin.html), [COMMIT](https://www.postgresql.org/docs/18/sql-commit.html), [ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html)
- [SQLSTATE codes](https://www.postgresql.org/docs/18/errcodes-appendix.html): 25P02 is in_failed_sql_transaction
- [The same lesson on MySQL](/mysql/01-basics/begin-commit-rollback)
