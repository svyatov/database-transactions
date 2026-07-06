# Snapshots & the four isolation levels

Isolation — the I in ACID — answers one question: **what do concurrent transactions see of
each other's work?** Perfect isolation (every transaction behaves as if it ran alone) costs
performance, so SQL lets you trade correctness for speed by choosing an *isolation level*.
This chapter shows you exactly what each trade buys — and what it silently gives away.

## The SQL standard's view

The SQL standard defines four levels by which *anomalies* they permit:

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | permitted | permitted | permitted |
| READ COMMITTED | — | permitted | permitted |
| REPEATABLE READ | — | — | permitted |
| SERIALIZABLE | — | — | — |

The vocabulary, in one line each:

- **Dirty read** — seeing another transaction's *uncommitted* data.
- **Non-repeatable read** — reading the same row twice and getting different data, because
  someone committed in between.
- **Phantom read** — running the same *range query* twice and getting new rows.

The standard's list is famously incomplete — it says nothing about **lost updates**,
**write skew**, or the **read-only anomaly**. All three are real, all three are demonstrated
in this chapter, and the [anomaly catalog](/02-isolation/anomaly-catalog) maps every one of
them to the level that stops it.

## How PostgreSQL actually does it: snapshots

PostgreSQL implements isolation with **MVCC** (multi-version concurrency control): writers
create new row *versions* instead of overwriting, and every query reads from a **snapshot** —
a frozen view of which transactions' work is visible. That architecture has one famous
consequence: **readers never block writers, and writers never block readers.** Only writers
competing for the *same rows* wait for each other (you'll see plenty of that in this chapter).

The levels differ mainly in *when the snapshot is taken*:

| You ask for | You get | Snapshot |
|---|---|---|
| READ UNCOMMITTED | READ COMMITTED behavior | new snapshot **per statement** |
| READ COMMITTED *(default)* | READ COMMITTED | new snapshot **per statement** |
| REPEATABLE READ | snapshot isolation — stronger than the standard's RR | one snapshot **per transaction** |
| SERIALIZABLE | REPEATABLE READ + serializability monitoring (SSI) | one snapshot per transaction |

Two PostgreSQL-specific facts worth internalizing now, both proven in the next lessons:

1. **Dirty reads are impossible at every level.** READ UNCOMMITTED is accepted as syntax and
   silently behaves as READ COMMITTED — [proof](/02-isolation/read-committed).
2. **REPEATABLE READ also prevents phantoms**, which the standard doesn't require —
   [proof](/02-isolation/repeatable-read).

## Choosing a level

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;         -- per transaction (most common)
BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;  -- same thing, two steps
SET default_transaction_isolation = 'repeatable read'; -- session/server default
```

The level must be chosen before the transaction's first query — at REPEATABLE READ and above,
that first query is what takes the snapshot.

## Further reading

- [PostgreSQL docs: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) —
  the single best chapter of the official manual; this chapter of the tutorial is essentially
  that page with executable proofs.
