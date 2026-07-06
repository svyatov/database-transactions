# What is a transaction?

A transaction groups several statements into one unit of work that either **fully happens or
fully doesn't**. The classic example: moving money between two accounts takes two UPDATEs, and
the world must never see — or keep — only one of them.

::: tip How to read the demos
Each lesson shows the real scenario code (sessions `A`, `B`, … are separate PostgreSQL
connections) followed by a transcript generated from an actual run. The four verbs
(`` A`…` ``, `A.fails`, `B.blocked`, `pending.success()`) are explained in
[Why trust this site?](/about/methodology)
:::

## ACID, briefly

| Property | Meaning | Where you'll see it proven |
|---|---|---|
| **Atomicity** | All of the transaction's writes survive, or none do | this page, below |
| **Consistency** | Constraints hold before and after — never "in between" for others | this page, below |
| **Isolation** | Concurrent transactions don't trample each other — *to a configurable degree* | [Chapter 2](/02-isolation/snapshots-and-the-four-levels), the most interesting chapter |
| **Durability** | Once COMMIT returns, the data survives a crash | prose only — crash tests don't fit in a transcript |

## Atomicity, demonstrated

Session A transfers 150 from alice (who has only 100) to bob. The credit to bob *succeeds*;
the debit from alice violates a `CHECK` constraint. Watch what happens to bob's
already-successful credit:

<<< ../../scenarios/01-basics/atomicity.ts#demo{ts}

<!--@include: ./parts/atomicity.md-->

## Key takeaways

- A failed statement doesn't just fail itself — it dooms the transaction; the only exit is
  `ROLLBACK` (or a [savepoint](/01-basics/savepoints)).
- Statements that succeeded *inside* a rolled-back transaction leave **no trace**. There is no
  "partial commit".
- Other sessions never see intermediate states: B read bob's balance mid-transfer and got the
  old value. What exactly other sessions see, and when, is the subject of
  [isolation levels](/02-isolation/snapshots-and-the-four-levels).

## Further reading

- [PostgreSQL docs: Transactions (tutorial)](https://www.postgresql.org/docs/current/tutorial-transactions.html)
