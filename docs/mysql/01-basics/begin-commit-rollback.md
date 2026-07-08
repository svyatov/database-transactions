# BEGIN, COMMIT, ROLLBACK

MySQL runs with `autocommit = 1` by default: every statement outside an explicit transaction
is its own transaction, committed the instant it finishes. `BEGIN` (an alias for
`START TRANSACTION`) suspends that until you `COMMIT` or `ROLLBACK`.

## Autocommit and visibility

<!--@include: ./parts/autocommit-visibility.md-->

## An error does NOT abort the transaction

Here MySQL and PostgreSQL part ways completely. In PostgreSQL, any error aborts the whole
transaction — every further statement is refused with `25P02` until you roll back. MySQL
rolls back only the failed statement and carries on as if nothing happened:

<!--@include: ./parts/aborted-transaction.md-->

This is convenient — and dangerous: application code that assumes "an error means nothing
committed" is wrong on MySQL. If your error handler doesn't explicitly `ROLLBACK`, every
statement that succeeded before *and after* the error will commit.

Without `BEGIN`, every statement commits on its own, so there's nothing to roll back a moment
later; wrap the work in a transaction and your changes stay invisible to others until
`COMMIT`, with [chapter 2](/mysql/02-isolation/snapshots-and-the-four-levels) covering the
exact visibility rules. After an error the transaction is still alive and only the failed
statement was undone, so decide explicitly whether to retry that statement or `ROLLBACK`
everything — [the same lesson for PostgreSQL](/postgres/01-basics/begin-commit-rollback)
proves the opposite behavior. And watch for statements that
[commit implicitly](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html): DDL like
`ALTER TABLE` or `CREATE INDEX` commits your open transaction before it runs.

## Further reading

- [MySQL docs: autocommit, Commit, and Rollback](https://dev.mysql.com/doc/refman/8.4/en/innodb-autocommit-commit-rollback.html)
- [MySQL docs: Statements That Cause an Implicit Commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
