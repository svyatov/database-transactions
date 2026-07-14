---
description: What a database transaction is, and what ACID (atomicity, consistency, isolation, durability) actually promises. Every claim linked to a proof run on real PostgreSQL and MySQL.
---

# What is a transaction?

A transaction groups several statements into one unit of work that either fully happens or
fully doesn't. The classic example: moving money between two accounts takes two UPDATEs, and
the world must never see (or keep) only one of them.

That single sentence hides four distinct promises, named by the most durable acronym in
databases.

## ACID

| Property | Meaning | Proven on |
|---|---|---|
| **Atomicity** | All of the transaction's writes survive, or none do | [PostgreSQL](/postgres/01-basics/what-is-a-transaction#atomicity-demonstrated) · [MySQL](/mysql/01-basics/what-is-a-transaction#atomicity-demonstrated) |
| **Consistency** | Constraints hold before and after, never "in between" for others | [PostgreSQL](/postgres/01-basics/what-is-a-transaction#atomicity-demonstrated) · [MySQL](/mysql/01-basics/what-is-a-transaction#atomicity-demonstrated) |
| **Isolation** | Concurrent transactions don't trample each other, *to a configurable degree* | [PostgreSQL](/postgres/02-isolation/snapshots-and-the-four-levels) · [MySQL](/mysql/02-isolation/snapshots-and-the-four-levels) |
| **Durability** | Once COMMIT returns, the data survives a crash | prose only: crash tests don't fit in a transcript |

Two of the letters carry the weight in day-to-day work. *Atomicity* is what lets you write
the two UPDATEs without a plan for "the first succeeded and the second didn't": statements
that succeeded *inside* a rolled-back transaction leave no trace, since there is no "partial
commit". *Isolation* is the interesting one, because it is *configurable*: its dial is the
[isolation level](/concepts/isolation-levels), and most of this site is about what each
setting silently gives away.

## Same promise, different temperament

The definition above is engine-neutral; the behavior around failure is not. When a statement
inside a transaction fails:

- **PostgreSQL dooms the transaction**: nothing in it can ever commit; every subsequent
  statement fails until you roll back, fully or to a savepoint
  ([proof](/postgres/01-basics/begin-commit-rollback)).
- **MySQL carries on**: only the failed statement is rolled back; the transaction stays
  usable and may still commit its successful statements
  ([proof](/mysql/01-basics/begin-commit-rollback)).

Code ported between the two on the assumption that "errors work the same everywhere" is
wrong in both directions.

## See it happen

- [PostgreSQL: what is a transaction?](/postgres/01-basics/what-is-a-transaction). A
  transfer dies on a `CHECK` constraint; watch the already-successful credit vanish
- [MySQL: what is a transaction?](/mysql/01-basics/what-is-a-transaction). The same demo,
  plus what happens on non-transactional storage engines
