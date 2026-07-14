---
description: "The lost update problem: two transactions read a value, compute in application code, and write back; one update silently vanishes. Definition, diagram, the three structural fixes, and how PostgreSQL and MySQL differ."
---

# The lost update problem

The most common transaction bug in real applications looks like this innocent pseudocode:

```ts
const balance = await db.query("SELECT balance FROM accounts WHERE id = $1", [id]);
await db.query("UPDATE accounts SET balance = $1 WHERE id = $2", [balance + 10, id]);
```

Read, modify in application code, write back. Run two of these concurrently and one deposit
vanishes, no error, no log line, nothing:

```timeline
Session A: SELECT balance → 100
Session B: SELECT balance → 100
Session A: UPDATE balance = 100 + 10
Session A: COMMIT
Session B: UPDATE balance = 100 + 10 ← overwrites A's deposit
Session B: COMMIT
Session B: final balance 110, not 120 — one deposit is gone
```

The SQL standard doesn't even list this anomaly (the literature calls it *P4*); production
incident reports list it constantly. The write itself is perfectly legal: B updates through
a value that was true when it read it. The loss comes from the *gap* between B's read and B's
write.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ COMMITTED | *(not addressed)* | **silent loss** ([proof](/postgres/02-isolation/lost-update#watch-a-deposit-disappear)) | **silent loss** ([proof](/mysql/02-isolation/lost-update#at-read-committed)) |
| REPEATABLE READ | *(not addressed)* | rejected with `40001` ([proof](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error)) | **still silent** ([proof](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you)) |
| SERIALIZABLE | prevented (by definition) | rejected with `40001` | prevented (locks + deadlock `1213`) |

This table holds the sharpest PostgreSQL/MySQL divergence on the whole site. PostgreSQL's
REPEATABLE READ refuses to write through a stale snapshot; MySQL's UPDATE is a *current read*
that applies your stale arithmetic to the newest row version and raises nothing. Code that
relies on PostgreSQL's `40001` to catch this loses that protection silently when ported.

## The fixes

Raising the isolation level is only one fix. On MySQL it isn't even one, short of
SERIALIZABLE. The structural fixes work on both engines at any level:

1. **Atomic UPDATE**. Do the math in SQL, not in the app:
   `UPDATE accounts SET balance = balance + 10 WHERE id = 1`. The row lock serializes the
   two increments; there is no gap to fall into.
2. **Pessimistic locking**. Read with `SELECT … FOR UPDATE`; the second reader waits until
   the first commits, then sees the fresh value.
3. **Optimistic locking**. A version column checked in the WHERE clause:
   `UPDATE … SET balance = ?, version = version + 1 WHERE id = ? AND version = ?`. Zero rows
   affected means someone got there first: reread and retry.

All three are demonstrated with transcripts in
[fixing lost updates on PostgreSQL](/postgres/05-patterns/fixing-lost-updates) and
[on MySQL](/mysql/05-patterns/fixing-lost-updates).

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
