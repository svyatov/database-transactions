# BEGIN, COMMIT, ROLLBACK

The [MySQL 8.4 autocommit contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-autocommit-commit-rollback.html)
starts new sessions with `autocommit=1`. A successful standalone InnoDB statement
commits its transaction. `BEGIN`, an alias for `START TRANSACTION`, starts an explicit
transaction that ends with COMMIT or ROLLBACK. With `autocommit=0`, transactions
remain open between statements, and a new one starts after COMMIT or ROLLBACK.
Drivers can issue BEGIN or change these settings, so check the actual connection.

## Autocommit and visibility

This MySQL 8.4.11 Scenario asserts autocommit and isolation settings. B's standalone
consistent SELECT takes a new snapshot for each query and sees A's successful commit.
A pre-existing REPEATABLE READ snapshot need not see a later commit, and READ
UNCOMMITTED can see uncommitted changes. COMMIT does not refresh every reader's view.

<!--@include: ./parts/autocommit-visibility.md-->

## Duplicate-key error without IGNORE preserves the transaction {#an-error-does-not-abort-the-transaction}

The demonstrated **duplicate-key INSERT error does not abort this transaction**.
The [InnoDB error-handling contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)
documents statement rollback for duplicate-key errors without IGNORE. The Scenario
asserts the earlier and later successful INSERTs after COMMIT.

<!--@include: ./parts/aborted-transaction.md-->

Do not treat every error this way. Documented exceptions in that same manual section:

- A deadlock rolls back the **entire transaction**. Start a fresh attempt, repeating
  reads and decisions, or return a controlled failure.
- A row-lock wait timeout rolls back the **waiting statement** by default. With
  `innodb_rollback_on_timeout=ON`, it rolls back the entire transaction.

**Entailed guarantee, by inference:** a missing COMMIT reply does not establish
rollback. The [COMMIT contract](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
makes successful changes permanent. If COMMIT succeeds but its reply is lost, the
changes remain committed; if COMMIT never reaches the server, that commit has not
happened. The missing reply alone cannot distinguish these cases. After connection
loss, reconnect and determine the outcome before repeating the work. No Transcript
here demonstrates a network failure.

If the application abandons an open transaction after a statement error, explicitly
ROLLBACK. Continuing to COMMIT can retain earlier changes. A savepoint can discard a
[multi-statement branch](/mysql/01-basics/savepoints), but cannot recover a transaction
already rolled back by a deadlock. PostgreSQL's
[failed explicit-transaction example](/postgres/01-basics/begin-commit-rollback)
has a different error state and savepoint recovery path.

## Implicit transaction boundaries

The [MySQL 8.4 implicit-commit list](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
includes ALTER TABLE and CREATE INDEX, which commit preceding work before running.
START TRANSACTION also commits an existing transaction: transactions do not nest.
CREATE TEMPORARY TABLE and DROP TEMPORARY TABLE do not implicitly commit, but their
creation or removal cannot be rolled back. These are Documented contracts, not SQL
executed in the two Transcripts above. See the
[DDL example](/mysql/05-patterns/orm-pitfalls) for the existing index-build Scenario.

## Further reading

- [MySQL 8.4: START TRANSACTION, COMMIT, and ROLLBACK](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
- [The same lesson on PostgreSQL](/postgres/01-basics/begin-commit-rollback)
