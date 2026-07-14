# BEGIN, COMMIT, ROLLBACK

Here's the part many working devs never learned: there is no such thing as "outside a
transaction" in PostgreSQL. Every statement you've ever run was in one. Without `BEGIN`,
PostgreSQL wraps each statement in its own tiny transaction and commits it the moment it
finishes. That's [*autocommit*](https://www.postgresql.org/docs/current/tutorial-transactions.html)
(the manual: "each individual statement has an implicit `BEGIN` and (if successful) `COMMIT`
wrapped around it").

`BEGIN` (or `START TRANSACTION`) says: *keep the transaction open, I have more
statements coming.* From then on, nothing is visible to anyone else until `COMMIT`, and
everything can still be abandoned with `ROLLBACK`.

## Autocommit and visibility, demonstrated

<!--@include: ./parts/autocommit-visibility.md-->

## One error poisons the whole transaction

A surprise that bites every ORM user eventually: after any error inside a transaction,
PostgreSQL refuses every further statement, even perfectly valid ones, with SQLSTATE
`25P02` (`in_failed_sql_transaction`) until you `ROLLBACK`.

<!--@include: ./parts/aborted-transaction.md-->

So autocommit isn't a mode you flip off server-side; it's the default that "commit after every
statement" describes, and you opt out of it one transaction at a time with `BEGIN`. The moment
you do, keep that transaction short: an open `BEGIN` that holds the connection through slow work
leaves everyone else waiting on your locks, a theme the locking and MVCC chapters return to. And
when `current transaction is aborted, commands ignored until end of transaction block` shows up
in your logs, some earlier statement failed and your code kept going. The fix lives in your
error handling, or in [savepoints](/postgres/01-basics/savepoints).

## ROLLBACK undoes DDL too

A migration inserts a backfill row, adds an index, creates a bookkeeping table, and then trips
over a constraint violation on step four. On MySQL you now own a half-migrated database: each
schema change committed itself, and everything before it, the moment it ran. On PostgreSQL you
type `ROLLBACK` and the migration never happened, schema included.

<!--@include: ./parts/ddl-rollback.md-->

Watch session B through the middle of that transcript. It counts zero rows after A's `INSERT`,
which you'd expect, and it still counts zero after A's `CREATE INDEX`, which is the part worth
sitting with: the DDL committed nothing on its way past. B's read of `migration_log` doesn't come
back empty either. It fails with `42P01`, because a table that exists only inside someone else's
open transaction doesn't exist for you at all. Schema lives in catalog rows, and catalog rows obey
[MVCC](/postgres/04-mvcc/row-versions) like every other row.

Then `ROLLBACK`, and both relations are gone. `to_regclass` returns `NULL` for a relation that
isn't there rather than raising an error, so B can point it at the table and the index alike and
get an answer instead of a failure. That's the guarantee in full: wrap a migration in `BEGIN`,
and either all of it lands or none of it does.

Run that same script on MySQL and the `CREATE INDEX` performs an implicit `COMMIT` first, so the
closing `ROLLBACK` undoes nothing at all. [The MySQL lesson](/mysql/05-patterns/orm-pitfalls)
proves it with the same beats and the opposite ending.

One caveat, and it's the reason this section says *ordinary* DDL rather than *all* DDL. A handful
of statements refuse to run inside a transaction block. The
[manual](https://www.postgresql.org/docs/current/sql-createindex.html) puts it plainly for the one
you're likeliest to meet: "a regular `CREATE INDEX` command can be performed within a transaction
block, but `CREATE INDEX CONCURRENTLY` cannot." `VACUUM`, `CREATE DATABASE`, and `ALTER SYSTEM`
behave the same way, each rejecting an open transaction with `25001` (`active_sql_transaction`);
the manual documents the restriction on every such statement's own page rather than in one central
list. A migration that needs one of them runs it outside the wrapper, and gives up atomicity for
that step.

## Further reading

- [PostgreSQL docs: BEGIN](https://www.postgresql.org/docs/current/sql-begin.html) ·
  [COMMIT](https://www.postgresql.org/docs/current/sql-commit.html) ·
  [ROLLBACK](https://www.postgresql.org/docs/current/sql-rollback.html)
- [PostgreSQL docs: SQLSTATE codes (Appendix A)](https://www.postgresql.org/docs/current/errcodes-appendix.html):
  `25P02` is `in_failed_sql_transaction`
- [PostgreSQL docs: CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html):
  regular builds run inside a transaction block, `CONCURRENTLY` cannot
- [The same lesson on MySQL](/mysql/01-basics/begin-commit-rollback)
