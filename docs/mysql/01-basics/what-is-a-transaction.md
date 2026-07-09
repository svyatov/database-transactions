# What is a transaction?

A transaction groups several statements into one unit of work that either happens completely
or not at all — the engine-neutral theory, ACID and what each letter promises, lives in
[Concepts: what is a transaction?](/concepts/what-is-a-transaction). This page is MySQL
keeping the promise — with one caveat PostgreSQL doesn't have.

::: tip How to read the demos
Each lesson shows a transcript generated from an actual run of the scenario: plain SQL,
color-coded per session (`A`, `B`, … are separate MySQL connections). How the transcripts
are produced and verified is explained in [What this is](/about/methodology)
:::

The caveat: all of this applies to InnoDB, MySQL's default storage engine. Tables on
other engines (e.g. `MyISAM`) are not transactional at all — their writes commit instantly,
always.

## Atomicity, demonstrated

Session A transfers 150 from alice (who has only 100) to bob. The credit to bob *succeeds*;
the debit from alice violates a `CHECK` constraint. Watch what happens to bob's
already-successful credit:

<!--@include: ./parts/atomicity.md-->

Two things to carry forward. Unlike PostgreSQL, a failed statement doesn't doom a MySQL
transaction — you may roll back, but you're not forced to, as the next lesson
[proves](/mysql/01-basics/begin-commit-rollback). And other sessions never saw an intermediate
state: B read bob's balance mid-transfer and got the old value, which is exactly what
[isolation levels](/mysql/02-isolation/snapshots-and-the-four-levels) govern.

## Further reading

- [MySQL docs: START TRANSACTION, COMMIT, and ROLLBACK Statements](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
- [MySQL docs: InnoDB and the ACID Model](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html)
- [The same lesson on PostgreSQL](/postgres/01-basics/what-is-a-transaction)
