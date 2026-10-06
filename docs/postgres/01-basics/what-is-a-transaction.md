# What is a transaction?

A transaction groups database work into a unit that can commit or roll back. The
[PostgreSQL 18 transaction tutorial](https://www.postgresql.org/docs/18/tutorial-transactions.html)
documents this contract. ACID terminology is in
[Concepts: what is a transaction?](/concepts/what-is-a-transaction).

::: tip How to read the demos
The Transcripts below are generated from Scenarios with separate PostgreSQL connections.
Their footers identify the executed server version, currently PostgreSQL 18.6. Assertions
establish the displayed outcomes for these schedules, not every possible schedule.
Manual links identify Documented contracts; marked derivations identify Entailed guarantees.
See [the methodology](/about/methodology) for the runner and generation process.
:::

## Atomicity, demonstrated

A credits bob, then attempts to debit 150 from alice, whose balance is only 100.
The debit violates the table's CHECK constraint. After full ROLLBACK, the Scenario
asserts both original balances. B's plain SELECT also asserts that A's uncommitted
credit was not visible at READ COMMITTED.

<!--@include: ./parts/atomicity.md-->

This statement error leaves the explicit transaction failed. Full ROLLBACK discards
the earlier credit; a savepoint established before a statement error can instead
permit [partial recovery](/postgres/01-basics/savepoints). Error scope depends on
whether a transaction block is open and which error occurred, as the
[next lesson](/postgres/01-basics/begin-commit-rollback) explains.

This atomicity claim concerns transactional table changes. It does not include external
effects or sequence counters. The [isolation manual's sequence warning](https://www.postgresql.org/docs/18/transaction-iso.html)
documents that sequence changes are visible immediately and are not rolled back.

## Further reading

- [PostgreSQL 18: Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- [The same lesson on MySQL](/mysql/01-basics/what-is-a-transaction)
