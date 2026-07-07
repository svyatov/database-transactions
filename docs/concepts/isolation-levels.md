---
description: The four SQL-standard transaction isolation levels — READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE — what each permits, how MVCC snapshots implement them, and where PostgreSQL and MySQL diverge.
---

# Isolation levels

Isolation — the I in [ACID](/concepts/what-is-a-transaction#acid) — answers one question:
**what do concurrent transactions see of each other's work?** Perfect isolation (every
transaction behaves as if it ran alone) costs performance, so SQL lets you trade correctness
for speed by choosing an *isolation level*.

## The SQL standard's four levels

The standard defines the levels by which *anomalies* they permit:

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | permitted | permitted | permitted |
| READ COMMITTED | — | permitted | permitted |
| REPEATABLE READ | — | — | permitted |
| SERIALIZABLE | — | — | — |

The vocabulary, in one line each:

- **[Dirty read](/concepts/dirty-read)** — seeing another transaction's *uncommitted* data.
- **[Non-repeatable read](/concepts/non-repeatable-read)** — reading the same row twice and
  getting different data, because someone committed in between.
- **[Phantom read](/concepts/phantom-read)** — running the same *range query* twice and
  getting new rows.

The standard's list is famously incomplete — it says nothing about
**[lost updates](/concepts/lost-update)**, **[write skew](/concepts/write-skew)**, or the
**read-only anomaly**. All three are real, and the
[anomaly catalog](/concepts/isolation-anomalies) maps every one of them to the levels that
stop it — per engine, with proof.

## How MVCC engines implement the ladder: snapshots

Both PostgreSQL and InnoDB (MySQL's default engine) use **MVCC** — multi-version concurrency
control: writers create new row *versions* instead of overwriting in place, and plain reads
look at a **snapshot**, a frozen view of which transactions' work is visible. Readers don't
block writers; writers don't block readers. On this architecture the levels differ mainly in
*when the snapshot is taken*:

- **READ COMMITTED** — a fresh snapshot **per statement**. Each statement sees everything
  committed before *it* began; two statements in one transaction may disagree.
- **REPEATABLE READ** — one snapshot **per transaction**. What you saw once, you'll see
  again.
- **SERIALIZABLE** — the per-transaction snapshot, plus a mechanism for the interleavings a
  snapshot alone can't catch — and here the two engines part ways completely.

## Same names, different contracts

| | PostgreSQL | MySQL (InnoDB) |
|---|---|---|
| **Default level** | READ COMMITTED | REPEATABLE READ |
| **READ UNCOMMITTED** | silently behaves as READ COMMITTED — dirty reads are impossible at every level ([proof](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them)) | means it — really serves uncommitted data ([proof](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it)) |
| **REPEATABLE READ** | also blocks phantoms; writing through a stale snapshot aborts with `40001` ([proof](/postgres/02-isolation/repeatable-read)) | plain SELECTs are snapshot-stable, but UPDATE/DELETE are *current reads* that bypass the snapshot ([proof](/mysql/02-isolation/repeatable-read)) |
| **SERIALIZABLE** | optimistic — SSI dependency tracking, conflicts abort with `40001` ([proof](/postgres/02-isolation/serializable)) | pessimistic — every read takes a shared lock, conflicts surface as deadlocks `1213` ([proof](/mysql/02-isolation/serializable)) |

The practical consequence: an application tuned for one engine's contract can carry a silent
bug on the other — the sharpest example being
[lost updates](/concepts/lost-update#who-prevents-it), which PostgreSQL's REPEATABLE READ
rejects and MySQL's lets through.

## Go deeper

- [PostgreSQL: snapshots & the four levels](/postgres/02-isolation/snapshots-and-the-four-levels) —
  how to set levels, and the two PostgreSQL-specific facts worth internalizing
- [MySQL: snapshots & the four levels](/mysql/02-isolation/snapshots-and-the-four-levels) —
  the level table as InnoDB actually implements it, dirty reads included
- [The anomaly catalog](/concepts/isolation-anomalies) — every anomaly, every level, both
  engines
