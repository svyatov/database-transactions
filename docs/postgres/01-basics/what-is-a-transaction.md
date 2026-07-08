# What is a transaction?

A transaction groups several statements into one unit of work that either fully happens or
fully doesn't — the engine-neutral theory, ACID and what each letter promises, lives in
[Concepts: what is a transaction?](/concepts/what-is-a-transaction). This page is PostgreSQL
keeping the promise.

::: tip How to read the demos
Each lesson shows a transcript generated from an actual run of the lesson's scenario
(sessions `A`, `B`, … are separate PostgreSQL connections). How the scenarios work — and
why the transcripts can't drift from reality — is explained in
[What this is](/about/methodology)
:::

## Atomicity, demonstrated

Session A transfers 150 from alice (who has only 100) to bob. The credit to bob *succeeds*;
the debit from alice violates a `CHECK` constraint. Watch what happens to bob's
already-successful credit:

<!--@include: ./parts/atomicity.md-->

A failed statement doesn't only fail itself, it dooms the whole transaction: nothing in it can
ever commit, and your only move is to roll back — fully, or to a
[savepoint](/postgres/01-basics/savepoints). Notice too that B never saw the half-finished
transfer; it read bob's old balance while the credit was still in flight. What other sessions
see of your in-flight work, and exactly when, is the entire subject of
[isolation levels](/postgres/02-isolation/snapshots-and-the-four-levels).

## Further reading

- [PostgreSQL docs: Transactions (tutorial)](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [The same lesson on MySQL](/mysql/01-basics/what-is-a-transaction)
