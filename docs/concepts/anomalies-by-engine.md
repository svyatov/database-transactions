---
description: One row per isolation anomaly, one column per engine — the weakest level at which PostgreSQL and MySQL each prevent it, every cell linked to the transcript that proves it.
---

# Anomalies by engine

Ask PostgreSQL and MySQL the same question (*at which isolation level do you stop me from
losing an update?*) and you get answers two levels apart. PostgreSQL says REPEATABLE READ and
hands you a `40001` to retry. MySQL says SERIALIZABLE, and gets there with locks. That single
divergence decides whether the default isolation level in your ORM is safe for a
read-modify-write, and it's the row this page exists for.

Below, each row is one anomaly from the [catalog](/concepts/isolation-anomalies), and each cell
names the weakest isolation level at which that engine prevents it — or says the engine prevents
it at every level it offers.

One caution before you read across a row: the two columns are separate ladders. MySQL offers
READ UNCOMMITTED and PostgreSQL doesn't, so a cell means "the weakest rung *this* engine offers
that stops this anomaly" — never a position on one shared scale. Levels are spelled the way
you'd type them after `SET TRANSACTION ISOLATION LEVEL`.

| Code | Anomaly | PostgreSQL | MySQL |
|---|---|---|---|
| G0 | **Dirty write** | every level — [proof](/postgres/02-isolation/anomaly-catalog#dirty-writes-g0) | every level — [proof](/mysql/02-isolation/anomaly-catalog#dirty-writes-g0) |
| G1a | **Dirty read** (aborted read) | every level — [proof](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | READ COMMITTED † — [READ UNCOMMITTED really serves it](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) |
| G1b | **Intermediate read** | every level — [proof](/postgres/02-isolation/anomaly-catalog#intermediate-reads-g1b) | READ COMMITTED — [proof](/mysql/02-isolation/anomaly-catalog#intermediate-reads-g1b) |
| G1c | **Circular information flow** | every level — [proof](/postgres/02-isolation/anomaly-catalog#circular-information-flow-g1c) | READ COMMITTED — [proof](/mysql/02-isolation/anomaly-catalog#circular-information-flow-g1c) |
| OTV | **Observed transaction vanishes** | every level — [proof](/postgres/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv) | READ COMMITTED — [proof](/mysql/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv) |
| P2 | **Non-repeatable read** | REPEATABLE READ — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | REPEATABLE READ *for plain `SELECT`s* — [proof](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms) |
| G-single | **Read skew** | REPEATABLE READ — [proof](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed) | SERIALIZABLE † — the weaker level's [current reads](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds) write through its own snapshot |
| PMP | **Phantom read** | REPEATABLE READ — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | SERIALIZABLE † — the weaker level's [current reads](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot) see the phantoms its `SELECT`s don't |
| P4 | **Lost update** | REPEATABLE READ *as a retryable `40001`* — [proof](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error) | SERIALIZABLE † *with locks, so you retry on deadlock `1213`* — [the lesson](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |
| G2-item / G2 | **Write skew** (item & predicate) | SERIALIZABLE *as a retryable `40001`* — [proof](/postgres/02-isolation/serializable#the-same-interleaving-serializable) | SERIALIZABLE *with locks* — [proof](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |
| — | **Read-only anomaly** (Fekete et al.) | SERIALIZABLE *as a retryable `40001`* — [proof](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) | not catalogued |

† The guarantee holds, but no transcript on this site demonstrates it at that level — it follows
from the level's semantics rather than from a scenario we ran, and the link goes to the lesson
that explains it instead. [Hermitage](https://github.com/ept/hermitage), the cross-database suite
both catalogs answer, marks nothing: its reader cannot tell a tested cell from an asserted one.
Four cells here are asserted, and they say so.

## What the P4 row is telling you

Two adjacent cells, two levels apart, and the gap is the whole reason this site has two tracks.
PostgreSQL's REPEATABLE READ refuses to let a transaction overwrite a row it can no longer see,
so a lost update surfaces as an error you retry. MySQL's REPEATABLE READ gives your `SELECT` a
frozen snapshot and your `UPDATE` a live one, so the read-modify-write completes and one
deposit vanishes. Nothing errors. Nothing warns.

The `G-single` and `PMP` rows carry the same divergence for the same reason: a MySQL statement
that writes, or that reads `FOR UPDATE`, ignores the snapshot the transaction's plain reads live
in. That is why those cells collapse to SERIALIZABLE rather than to REPEATABLE READ with an
asterisk. On MySQL, the isolation knob protects reads; read-modify-write is
[fixed with locks or SQL arithmetic](/mysql/05-patterns/fixing-lost-updates).

## The full breakdown

This table collapses each engine's per-level grid to a single answer per anomaly. When you've
picked your engine, the answer sheet for it has one cell per anomaly per level, and a proof in
each:

- **[PostgreSQL's anomaly catalog](/postgres/02-isolation/anomaly-catalog)** — three levels;
  READ UNCOMMITTED is omitted because it aliases READ COMMITTED.
- **[MySQL's anomaly catalog](/mysql/02-isolation/anomaly-catalog)** — four levels, and a READ
  UNCOMMITTED column that really does serve dirty data.
