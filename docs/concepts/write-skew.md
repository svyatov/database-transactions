---
description: Write skew — two transactions each check an invariant, each write to a different row, and both commit, jointly breaking the rule both of them checked. Why only SERIALIZABLE stops it, on PostgreSQL and MySQL.
---

# Write skew

**Write skew** is the anomaly with no smoking gun: two transactions each *read* an invariant,
each *write* to a **different** row, and both commit. No write-write conflict ever happens —
the rows they touched don't overlap — and the invariant both of them checked is broken
anyway.

The canonical example: a hospital requires at least one doctor on call. Alice and Bob, both
on call, each request the night off. Each transaction checks "is anyone else on call?" — sees
the other — and proceeds:

```timeline
Alice: BEGIN
Bob: BEGIN
Alice: SELECT count(*) on call → 2 ← fine, Bob's still on
Bob: SELECT count(*) on call → 2 ← fine, Alice's still on
Alice: UPDATE alice SET on_call = false
Bob: UPDATE bob SET on_call = false
Alice: COMMIT
Bob: COMMIT ← both committed; nobody is on call
```

Formally Adya's **G2** (predicate) and **G2-item**. Snapshot-based REPEATABLE READ can't
catch it: each transaction's snapshot really did contain another doctor, each UPDATE touched
a different row, so there is nothing for a write-conflict check to object to. The decision
each transaction made was invalidated by the *other's write* — a read-write dependency, not a
write-write one.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| REPEATABLE READ | *(not addressed)* | **happens** — [proof](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew) | **happens** — [proof](/mysql/02-isolation/serializable#write-skew-at-repeatable-read) |
| SERIALIZABLE | prevented (by definition) | rejected with `40001` at COMMIT — [proof](/postgres/02-isolation/serializable#the-same-interleaving-serializable) | deadlock `1213`, detected instantly — [proof](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |

Same guarantee, opposite philosophies. PostgreSQL's SERIALIZABLE (SSI) is optimistic: both
transactions run without blocking, and the dependency tracker aborts one at commit. MySQL's
is pessimistic: every plain SELECT takes a shared lock, so the two UPDATEs collide with the
other's read lock — a cycle the deadlock detector breaks on the spot. Either way your retry
logic is not optional; only the error code differs.

Multi-row invariants — "at least one on call", "the sum stays positive", "unique-ish under
concurrency" — are only automatic at SERIALIZABLE. Below it, the fix is making the conflict
explicit: `SELECT … FOR UPDATE` on the rows the decision depends on, so the transactions
collide on purpose.

## Related anomalies

- [Lost update](/concepts/lost-update) — the single-row special case: there the two writes
  *do* overlap, which is why weaker mechanisms can catch it.
- [Read-only anomaly](/concepts/isolation-anomalies#the-read-only-anomaly) — write skew's
  strangest consequence: even a transaction that writes nothing can observe an impossible
  state.

## See it happen

- [PostgreSQL: Serializable](/postgres/02-isolation/serializable) — write skew at REPEATABLE
  READ, then the same interleaving under SSI
- [MySQL: Serializable](/mysql/02-isolation/serializable) — the same invariant dying, then
  saved by shared locks and a deadlock
