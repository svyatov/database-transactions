# Savepoints

A savepoint is a named bookmark inside a transaction. `ROLLBACK TO SAVEPOINT` rewinds to the
bookmark — undoing everything after it — while the transaction itself stays alive and can
continue. This is also the escape hatch from the "one error aborts everything" rule you saw in
the [previous lesson](/postgres/01-basics/begin-commit-rollback).

If you've ever used "nested transactions" in an ORM, you were using savepoints — PostgreSQL
has no actual nested transactions. Rails'
[`transaction(requires_new: true)`](https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/DatabaseStatements.html#method-i-transaction),
Django's [`atomic()` inside `atomic()`](https://docs.djangoproject.com/en/stable/topics/db/transactions/#django.db.transaction.atomic),
and SQLAlchemy's [`begin_nested()`](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#using-savepoint)
all emit `SAVEPOINT` under the hood. Mind the Rails default, though: a nested `transaction do`
block *without* `requires_new: true` creates no savepoint at all — it merely joins the outer
transaction, and a `raise ActiveRecord::Rollback` inside it is swallowed without rolling
anything back (the Rails docs [warn about exactly this](https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/DatabaseStatements.html#method-i-transaction)).

## Recovering from an error mid-transaction

<!--@include: ./parts/savepoint-recovery.md-->

## Nesting and RELEASE

Savepoints stack. Rolling back to an outer savepoint destroys the inner ones — and `RELEASE`
keeps the work but removes the bookmark:

<!--@include: ./parts/savepoint-nesting.md-->

The through-line: `ROLLBACK TO SAVEPOINT` un-aborts a failed transaction, losing only the work
after the savepoint, and rolling back to an outer savepoint destroys the inner ones (touch one
afterwards and you get `3B001`). `RELEASE SAVEPOINT` says "I no longer need to rewind here" while
keeping the changes as part of the transaction. None of this is free, though: every savepoint
starts a [subtransaction](https://www.postgresql.org/docs/current/subxacts.html), and once you
pass 64 open subtransactions per backend, the manual warns that "the storage I/O overhead
increases significantly". A savepoint per row in a hot loop is a known performance trap — fine in
moderation, ruinous in bulk.

## Further reading

- [PostgreSQL docs: SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html) ·
  [ROLLBACK TO SAVEPOINT](https://www.postgresql.org/docs/current/sql-rollback-to.html) ·
  [RELEASE SAVEPOINT](https://www.postgresql.org/docs/current/sql-release-savepoint.html)
- [PostgreSQL docs: Subtransactions](https://www.postgresql.org/docs/current/subxacts.html) —
  what a savepoint actually costs
- [The same lesson on MySQL](/mysql/01-basics/savepoints)
