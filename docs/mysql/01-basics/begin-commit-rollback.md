# BEGIN, COMMIT, ROLLBACK

MySQL runs with `autocommit = 1` by default: every statement outside an explicit transaction
is its own transaction, committed the instant it finishes. `BEGIN` (an alias for
`START TRANSACTION`) suspends that until you `COMMIT` or `ROLLBACK`.

## Autocommit and visibility

<<< ../../../scenarios/mysql/01-basics/autocommit-visibility.ts#demo{ts}

<!--@include: ./parts/autocommit-visibility.md-->

## An error does NOT abort the transaction

Here MySQL and PostgreSQL part ways completely. In PostgreSQL, any error aborts the whole
transaction — every further statement is refused with `25P02` until you roll back. MySQL just
rolls back the **failed statement** and carries on as if nothing happened:

<<< ../../../scenarios/mysql/01-basics/aborted-transaction.ts#demo{ts}

<!--@include: ./parts/aborted-transaction.md-->

This is convenient — and dangerous: application code that assumes "an error means nothing
committed" is wrong on MySQL. If your error handler doesn't explicitly `ROLLBACK`, every
statement that succeeded before *and after* the error will commit.

## Key takeaways

- Without `BEGIN`, every statement commits on its own — there is nothing to roll back a moment
  later.
- Inside a transaction, your changes are invisible to others until `COMMIT`
  ([chapter 2](/mysql/02-isolation/snapshots-and-the-four-levels) covers the exact rules).
- After an error, the transaction is **still alive** — only the failed statement was undone.
  Decide explicitly: retry the statement, or `ROLLBACK` everything.
  Compare: [the same lesson for PostgreSQL](/postgres/01-basics/begin-commit-rollback)
  proves the opposite behavior.
- Beware statements that [commit implicitly](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html):
  DDL (`ALTER TABLE`, `CREATE INDEX`, …) commits your open transaction before it runs.

## Further reading

- [MySQL docs: autocommit, Commit, and Rollback](https://dev.mysql.com/doc/refman/8.4/en/innodb-autocommit-commit-rollback.html)
- [MySQL docs: Statements That Cause an Implicit Commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
