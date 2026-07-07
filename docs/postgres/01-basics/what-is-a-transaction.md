# What is a transaction?

A transaction groups several statements into one unit of work that either **fully happens or
fully doesn't**. The classic example: moving money between two accounts takes two UPDATEs, and
the world must never see — or keep — only one of them.

::: tip How to read the demos
Each lesson shows a transcript generated from an actual run of the lesson's scenario
(sessions `A`, `B`, … are separate PostgreSQL connections). How the scenarios work — and
why the transcripts can't drift from reality — is explained in
[What this is](/about/methodology)
:::

## ACID, briefly

| Property | Meaning | Where you'll see it proven |
|---|---|---|
| **Atomicity** | All of the transaction's writes survive, or none do | this page, below |
| **Consistency** | Constraints hold before and after — never "in between" for others | this page, below |
| **Isolation** | Concurrent transactions don't trample each other — *to a configurable degree* | [Chapter 2](/postgres/02-isolation/snapshots-and-the-four-levels), the most interesting chapter |
| **Durability** | Once COMMIT returns, the data survives a crash | prose only — crash tests don't fit in a transcript |

## Atomicity, demonstrated

Session A transfers 150 from alice (who has only 100) to bob. The credit to bob *succeeds*;
the debit from alice violates a `CHECK` constraint. Watch what happens to bob's
already-successful credit:

<!--@include: ./parts/atomicity.md-->

## Key takeaways

- A failed statement doesn't just fail itself — it dooms the transaction: nothing in it can
  ever commit; all you can do is roll back — fully, or to a [savepoint](/postgres/01-basics/savepoints).
- Statements that succeeded *inside* a rolled-back transaction leave **no trace**. There is no
  "partial commit".
- Other sessions never see intermediate states: B read bob's balance mid-transfer and got the
  old value. What exactly other sessions see, and when, is the subject of
  [isolation levels](/postgres/02-isolation/snapshots-and-the-four-levels).

## Further reading

- [PostgreSQL docs: Transactions (tutorial)](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [The same lesson on MySQL](/mysql/01-basics/what-is-a-transaction)
