# Savepoints

A savepoint is a named bookmark inside a transaction: `ROLLBACK TO SAVEPOINT` rewinds the
transaction's work back to it without giving up the transaction itself.

In PostgreSQL, savepoints are how you *recover from errors* mid-transaction. MySQL
[doesn't abort transactions on error](/mysql/01-basics/begin-commit-rollback), so you rarely
need them for that. Their job here is to discard a multi-statement branch in one go.

## Discard a risky branch

The risky part of the transaction made real progress before failing. A single
`ROLLBACK TO SAVEPOINT` undoes all of it, including the statements that succeeded:

<!--@include: ./parts/savepoint-recovery.md-->

## Nesting and RELEASE

<!--@include: ./parts/savepoint-nesting.md-->

`ROLLBACK TO SAVEPOINT` undoes the data changes made after the savepoint but keeps the
transaction (and the locks it took before the savepoint) alive. Roll back to an outer
savepoint and the inner ones vanish with it, so reaching for one afterward fails with errno
`1305`. `RELEASE SAVEPOINT` forgets a bookmark without undoing anything, and every savepoint
disappears on `COMMIT` or a full `ROLLBACK`.

## Further reading

- [MySQL docs: SAVEPOINT, ROLLBACK TO SAVEPOINT, and RELEASE SAVEPOINT](https://dev.mysql.com/doc/refman/8.4/en/savepoint.html)
- [The same lesson on PostgreSQL](/postgres/01-basics/savepoints)
