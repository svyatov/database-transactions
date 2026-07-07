---
description: A dirty read is reading another transaction's uncommitted data — a value that may be rolled back and never have existed. Definition, interleaving diagram, and which isolation levels prevent it on PostgreSQL and MySQL.
---

# Dirty read

A **dirty read** is reading another transaction's *uncommitted* data. The danger is not that
the data is fresh — it's that it may never become real: if the writer rolls back, you have
read, and possibly acted on, a value that **never existed**.

```timeline
Session A: BEGIN
Session B: BEGIN
Session A: UPDATE accounts SET balance = 999
Session B: SELECT balance → 999 ← uncommitted data
Session A: ROLLBACK
Session B: acts on a balance that never existed
```

Formally this is Adya's **G1a** (aborted read). Its sibling **G1b** (intermediate read) is
subtler — reading a *draft* the writer later overwrites before committing; both live in the
[anomaly catalog](/concepts/isolation-anomalies) with the rest of the G1 family.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ UNCOMMITTED | permitted | impossible — the level [silently behaves as READ COMMITTED](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | **happens** — [proof](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) |
| READ COMMITTED and up | prevented | impossible | prevented — [proof](/mysql/02-isolation/anomaly-catalog#what-read-uncommitted-really-costs) |

In PostgreSQL dirty reads are impossible at *every* level — READ UNCOMMITTED is accepted as
syntax and silently upgraded. MySQL takes you at your word: its READ UNCOMMITTED hands out
data that was never committed, which is why there is essentially no good reason to run at
that level.

## Related anomalies

- [Non-repeatable read](/concepts/non-repeatable-read) — the committed-data cousin: nothing
  you read is dirty, yet repeated reads still disagree.
- [Intermediate read (G1b)](/concepts/isolation-anomalies#intermediate-read-g1b) — the dirty
  read's nastier variant: a draft value that no committed history ever contained.

## See it happen

- [MySQL: READ UNCOMMITTED means it](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) —
  a real dirty read, in a verified transcript
- [PostgreSQL: no dirty reads, even if you ask](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them)
