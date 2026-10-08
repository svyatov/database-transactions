---
description: "A dirty read is reading another transaction's uncommitted data: a value that may be rolled back and never have existed. Definition, interleaving diagram, and which isolation levels prevent it on PostgreSQL and MySQL."
---

# Dirty read

A *dirty read* is reading another transaction's *uncommitted* data. The danger is not that
the data is fresh. It's that it may never become real: if the writer rolls back, you have
read a value that never became committed. Any external action based on it is hypothetical in this page's illustration; no receiver is executed.

```timeline
Session A: BEGIN
Session B: BEGIN
Session A: UPDATE accounts SET balance = 999
Session B: SELECT balance → 999 ← uncommitted data
Session A: ROLLBACK
Session B: acts on a balance that never existed
```

This is an illustrative schedule, not an additional executable Scenario.

Formally this is Adya's *G1a* (aborted read). Its sibling *G1b* (intermediate read) is
subtler: reading a *draft* the writer later overwrites before committing; both live in the
[anomaly catalog](/concepts/isolation-anomalies) with the rest of the G1 family.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ UNCOMMITTED | permitted | impossible: the level [silently behaves as READ COMMITTED](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | **happens** ([proof](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it)) |
| READ COMMITTED and up | excluded | M: excluded for concurrent table changes | M: excluded for concurrent table changes ([contract and examples](/mysql/02-isolation/anomaly-catalog#what-read-uncommitted-really-costs)) |

M means Documented contract, distinct from one demonstrated schedule. The [scoped isolation contracts](/concepts/isolation-levels) exclude other transactions' uncommitted table changes from ordinary consistent reads at READ COMMITTED and stronger levels; own writes and PostgreSQL sequences have separate rules. PostgreSQL accepts READ UNCOMMITTED as READ COMMITTED. InnoDB READ UNCOMMITTED permits the demonstrated dirty value; selecting it requires accepting that risk, not an unmeasured performance promise.

## Related anomalies

- [Non-repeatable read](/concepts/non-repeatable-read), the committed-data cousin: nothing
  you read is dirty, yet repeated reads still disagree.
- [Intermediate read (G1b)](/concepts/isolation-anomalies#intermediate-read-g1b), the dirty
  read's nastier variant: a draft value that no committed history ever contained.

## See it happen

- [MySQL: READ UNCOMMITTED means it](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it),
  a real dirty read, in a verified transcript
- [PostgreSQL: no dirty reads, even if you ask](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them)
