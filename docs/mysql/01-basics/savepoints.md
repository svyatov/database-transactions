# Savepoints

A savepoint is a named bookmark inside a transaction: `ROLLBACK TO SAVEPOINT` rewinds the
transaction's work back to it without giving up the transaction itself.

In PostgreSQL, savepoints are how you *recover from errors* mid-transaction. MySQL
[doesn't abort transactions on error](/mysql/01-basics/begin-commit-rollback), so you rarely
need them for that — their job here is to **discard a multi-statement branch in one go**.

## Discard a risky branch

The risky part of the transaction made real progress before failing. A single
`ROLLBACK TO SAVEPOINT` undoes all of it — including the statements that succeeded:

::: code-group
<<< ../../../scenarios/mysql/01-basics/savepoint-recovery.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/01-basics/savepoint-recovery.py#demo{py} [Python]
:::

<!--@include: ./parts/savepoint-recovery.md-->

## Nesting and RELEASE

::: code-group
<<< ../../../scenarios/mysql/01-basics/savepoint-nesting.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/01-basics/savepoint-nesting.py#demo{py} [Python]
:::

<!--@include: ./parts/savepoint-nesting.md-->

## Key takeaways

- `ROLLBACK TO SAVEPOINT` undoes *data changes* after the savepoint but keeps the transaction
  (and its locks acquired before the savepoint) alive.
- Rolling back to an outer savepoint destroys the inner ones — trying to use one later fails
  with errno `1305`.
- `RELEASE SAVEPOINT` forgets the bookmark without undoing anything.
- All savepoints vanish on `COMMIT` or full `ROLLBACK`.

## Further reading

- [MySQL docs: SAVEPOINT, ROLLBACK TO SAVEPOINT, and RELEASE SAVEPOINT](https://dev.mysql.com/doc/refman/8.4/en/savepoint.html)
