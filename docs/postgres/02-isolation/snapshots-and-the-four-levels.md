# Snapshots & the four levels

Isolation, the I in ACID, answers one question: what do concurrent transactions see of
each other's work? The SQL standard's four-level ladder, and the anomaly vocabulary that
defines it (dirty read, non-repeatable read, phantom, and the ones the standard famously
forgot), is covered in [Concepts: isolation levels](/concepts/isolation-levels). This chapter
shows what each level does *on PostgreSQL*: exactly what each trade buys, and what it
silently gives away.

## How PostgreSQL actually does it: snapshots

PostgreSQL implements isolation with *MVCC* (multi-version concurrency control): writers
create new row *versions* instead of overwriting, and every query reads from a *snapshot*,
a frozen view of which transactions' work is visible. That architecture has one famous
consequence: in [the manual's words](https://www.postgresql.org/docs/current/mvcc-intro.html),
"reading never blocks writing and writing never blocks reading". Only writers
competing for the *same rows* wait for each other (you'll see plenty of that in this chapter).

The levels differ mainly in *when the snapshot is taken*:

| You ask for | You get | Snapshot |
|---|---|---|
| READ UNCOMMITTED | READ COMMITTED behavior | new snapshot **per statement** |
| READ COMMITTED *(default)* | READ COMMITTED | new snapshot **per statement** |
| REPEATABLE READ | snapshot isolation, stronger than the standard's RR | one snapshot **per transaction** |
| SERIALIZABLE | REPEATABLE READ + serializability monitoring (SSI) | one snapshot per transaction |

Two PostgreSQL-specific facts worth internalizing now, both proven in the next lessons:

1. Dirty reads are impossible at every level. READ UNCOMMITTED is accepted as syntax and quietly
   behaves as READ COMMITTED: "In PostgreSQL READ UNCOMMITTED is treated as READ COMMITTED"
   ([SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)).
   [Proof](/postgres/02-isolation/read-committed).
2. REPEATABLE READ also prevents phantoms, which the standard doesn't require:
   [proof](/postgres/02-isolation/repeatable-read).

## Choosing a level

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;         -- per transaction (most common)
BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;  -- same thing, two steps
SET default_transaction_isolation = 'repeatable read'; -- session/server default
```

The level ["cannot be changed after the first query or data-modification statement"](https://www.postgresql.org/docs/current/sql-set-transaction.html)
of the transaction, and at REPEATABLE READ and above, that first statement (not `BEGIN`
itself) is what takes the snapshot.

## Further reading

- [PostgreSQL docs: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html):
  the single best chapter of the official manual; this chapter of the tutorial is that page
  with executable proofs attached.
- [PostgreSQL docs: Introduction to MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html) ·
  [SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
- [The same lesson on MySQL](/mysql/02-isolation/snapshots-and-the-four-levels)
