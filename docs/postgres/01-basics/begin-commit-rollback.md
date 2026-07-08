# BEGIN, COMMIT, ROLLBACK

Here's the part many working devs never learned: there is no such thing as "outside a
transaction" in PostgreSQL. Every statement you've ever run was in one. Without `BEGIN`,
PostgreSQL wraps each statement in its own tiny transaction and commits it the moment it
finishes — that's [*autocommit*](https://www.postgresql.org/docs/current/tutorial-transactions.html)
(the manual: "each individual statement has an implicit `BEGIN` and (if successful) `COMMIT`
wrapped around it").

`BEGIN` (or `START TRANSACTION`) says: *keep the transaction open, I have more
statements coming.* From then on, nothing is visible to anyone else until `COMMIT`, and
everything can still be abandoned with `ROLLBACK`.

## Autocommit and visibility, demonstrated

<!--@include: ./parts/autocommit-visibility.md-->

## One error poisons the whole transaction

A surprise that bites every ORM user eventually: after any error inside a transaction,
PostgreSQL refuses every further statement — even perfectly valid ones — with SQLSTATE
`25P02` (`in_failed_sql_transaction`) until you `ROLLBACK`.

<!--@include: ./parts/aborted-transaction.md-->

So autocommit isn't a mode you flip off server-side; it's the default that "commit after every
statement" describes, and you opt out of it one transaction at a time with `BEGIN`. The moment
you do, keep that transaction short: an open `BEGIN` that holds the connection through slow work
leaves everyone else waiting on your locks, a theme the locking and MVCC chapters return to. And
when `current transaction is aborted, commands ignored until end of transaction block` shows up
in your logs, some earlier statement failed and your code kept going — the fix lives in your
error handling, or in [savepoints](/postgres/01-basics/savepoints).

## Further reading

- [PostgreSQL docs: BEGIN](https://www.postgresql.org/docs/current/sql-begin.html) ·
  [COMMIT](https://www.postgresql.org/docs/current/sql-commit.html) ·
  [ROLLBACK](https://www.postgresql.org/docs/current/sql-rollback.html)
- [PostgreSQL docs: SQLSTATE codes (Appendix A)](https://www.postgresql.org/docs/current/errcodes-appendix.html) —
  `25P02` is `in_failed_sql_transaction`
- [The same lesson on MySQL](/mysql/01-basics/begin-commit-rollback)
