# BEGIN, COMMIT, ROLLBACK

Here's the part many working devs never learned: **there is no such thing as "outside a
transaction" in PostgreSQL.** Every statement you've ever run was in one. Without `BEGIN`,
PostgreSQL wraps each statement in its own tiny transaction and commits it the moment it
finishes — that's [*autocommit*](https://www.postgresql.org/docs/current/tutorial-transactions.html)
(the manual: "each individual statement has an implicit `BEGIN` and (if successful) `COMMIT`
wrapped around it").

`BEGIN` (or `START TRANSACTION`) simply says: *keep the transaction open, I have more
statements coming.* From then on, nothing is visible to anyone else until `COMMIT`, and
everything can still be abandoned with `ROLLBACK`.

## Autocommit and visibility, demonstrated

::: code-group
<<< ../../../scenarios/postgres/01-basics/autocommit-visibility.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/postgres/01-basics/autocommit-visibility.py#demo{py} [Python]
:::

<!--@include: ./parts/autocommit-visibility.md-->

## One error poisons the whole transaction

A surprise that bites every ORM user eventually: after **any** error inside a transaction,
PostgreSQL refuses **all** further statements — even perfectly valid ones — with SQLSTATE
`25P02` (`in_failed_sql_transaction`), until you `ROLLBACK`.

::: code-group
<<< ../../../scenarios/postgres/01-basics/aborted-transaction.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/postgres/01-basics/aborted-transaction.py#demo{py} [Python]
:::

<!--@include: ./parts/aborted-transaction.md-->

## Key takeaways

- Autocommit means "commit after every statement" — it is not a separate mode you can turn
  off server-side; you opt out per-transaction with `BEGIN`.
- If your app sends `BEGIN` and then holds the connection while doing slow work, everyone
  else may be waiting on your locks. Keep transactions short (a theme we'll return to in the
  locking and MVCC chapters).
- Seeing `current transaction is aborted, commands ignored until end of transaction block` in
  your logs means some earlier statement failed and the code kept going. The fix is in your
  error handling — or in [savepoints](/postgres/01-basics/savepoints).

## Further reading

- [PostgreSQL docs: BEGIN](https://www.postgresql.org/docs/current/sql-begin.html) ·
  [COMMIT](https://www.postgresql.org/docs/current/sql-commit.html) ·
  [ROLLBACK](https://www.postgresql.org/docs/current/sql-rollback.html)
- [PostgreSQL docs: SQLSTATE codes (Appendix A)](https://www.postgresql.org/docs/current/errcodes-appendix.html) —
  `25P02` is `in_failed_sql_transaction`
