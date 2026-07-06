# Savepoints

A savepoint is a named bookmark inside a transaction. `ROLLBACK TO SAVEPOINT` rewinds to the
bookmark — undoing everything after it — while the transaction itself stays alive and can
continue. This is also the escape hatch from the "one error aborts everything" rule you saw in
the [previous lesson](/01-basics/begin-commit-rollback).

If you've ever used "nested transactions" in an ORM (Rails' `requires_new`, Django's
`atomic()` inside `atomic()`, Sequelize nested `transaction()`), you were using savepoints —
PostgreSQL has no actual nested transactions.

## Recovering from an error mid-transaction

<<< ../../scenarios/01-basics/savepoint-recovery.ts#demo{ts}

<!--@include: ./parts/savepoint-recovery.md-->

## Nesting and RELEASE

Savepoints stack. Rolling back to an outer savepoint destroys the inner ones — and `RELEASE`
keeps the work but removes the bookmark:

<<< ../../scenarios/01-basics/savepoint-nesting.ts#demo{ts}

<!--@include: ./parts/savepoint-nesting.md-->

## Key takeaways

- `ROLLBACK TO SAVEPOINT` un-aborts a failed transaction — only the work after the savepoint
  is lost.
- Rolling back to an outer savepoint destroys inner savepoints (`3B001` if you try to use one
  afterwards).
- `RELEASE SAVEPOINT` = "I no longer need to rewind here"; the changes stay part of the
  transaction.
- Savepoints aren't free: each one that's still active when a row is modified adds bookkeeping
  (they're implemented as subtransactions). A loop that creates a savepoint per row on a hot
  path is a known performance trap — fine in moderation, dangerous in bulk.

## Further reading

- [PostgreSQL docs: SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html)
