---
description: "The lost update problem: two transactions read a value, compute in application code, and write back; one update silently vanishes. Definition, diagram, the three structural fixes, and how PostgreSQL and MySQL differ."
---

# The lost update problem

A possible stale-write bug is shown by this illustrative pseudocode:

```ts
const balance = await db.query("SELECT balance FROM accounts WHERE id = $1", [id]);
await db.query("UPDATE accounts SET balance = $1 WHERE id = $2", [balance + 10, id]);
```

Read, compute in application code, then write a literal value. In the illustrated order, two committed increments leave only one increment. The linked Scenarios read inside their stated transactions; no application logging behavior or incident frequency is measured.

```timeline
Session A: SELECT balance → 100
Session B: SELECT balance → 100
Session A: UPDATE balance = 100 + 10
Session A: COMMIT
Session B: UPDATE balance = 100 + 10 ← overwrites A's deposit
Session B: COMMIT
Session B: final balance 110, not 120 — one deposit is gone
```

The classic three-phenomenon standard table does not describe P4; SERIALIZABLE's serial-equivalence definition still constrains it. The timeline is illustrative. Linked Scenarios establish the stale overwrite under their own operation and transaction scope.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ COMMITTED | *(not addressed)* | **silent loss** ([proof](/postgres/02-isolation/lost-update#watch-a-deposit-disappear)) | **silent loss** ([proof](/mysql/02-isolation/lost-update#at-read-committed)) |
| REPEATABLE READ | *(not addressed)* | rejected with `40001` ([proof](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error)) | **still silent** ([proof](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you)) |
| SERIALIZABLE | serial-equivalence contract | M: changed-target conflict rule, scoped in the engine catalog | † retained in-transaction locks; no direct P4 execution here |

This table holds the sharpest PostgreSQL/MySQL divergence on the whole site. PostgreSQL's
REPEATABLE READ refuses to write through a stale snapshot; MySQL's UPDATE is a *current read*
that applies your stale arithmetic to the newest row version and raises nothing. Code that
relies on PostgreSQL's `40001` to catch this loses that protection silently when ported.

## The fixes

The linked repairs assert single-row deposits at their stated levels. They are not any-level or cross-row guarantees. All relevant writers must participate, locking reads and writes must share the transaction, and stronger-level errors still need handling:

1. **Atomic UPDATE**. Do the math in SQL, not in the app:
   `UPDATE accounts SET balance = balance + 10 WHERE id = 1`. The row lock serializes the
   two demonstrated increments. A stale literal writer outside this protocol can still overwrite the result.
2. **Pessimistic locking**. Read with `SELECT … FOR UPDATE`; the second reader waits until
   the first commits at the demonstrated level. A stronger PostgreSQL level can instead reject a changed target.
3. **Optimistic locking**. A version column checked in the WHERE clause:
   `UPDATE … SET balance = ?, version = version + 1 WHERE id = ? AND version = ?`. Zero rows
   affected rejects the attempted stale write in this protocol. A missing row is another possible cause; inspect the result and reconsider the decision. A stale human edit need not be retried automatically.

All three are demonstrated with transcripts in
[fixing lost updates on PostgreSQL](/postgres/05-patterns/fixing-lost-updates) and
[on MySQL](/mysql/05-patterns/fixing-lost-updates).

† The cooperating single-row protocol follows from the locking or checked-predicate boundary explained in those lessons, not every possible execution. The SERIALIZABLE P4 cells above likewise use [catalog contracts/derivations](/concepts/anomalies-by-engine); MySQL has no direct SERIALIZABLE P4 execution here. Values read outside a protected transaction, external effects, and cross-row invariants need separate protection.

## Related anomalies

- [Non-repeatable read](/concepts/non-repeatable-read): the read-only half of this problem;
  a lost update is what happens when you write back through it.
- [Write skew](/concepts/write-skew), the multi-row generalization: no write-write conflict
  at all, and still a broken invariant.

## See it happen

- [PostgreSQL: lost updates](/postgres/02-isolation/lost-update), the silent loss, then
  REPEATABLE READ turning it into an error
- [MySQL: lost updates](/mysql/02-isolation/lost-update), why no level below SERIALIZABLE
  saves you there
