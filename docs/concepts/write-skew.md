---
description: "The demonstrated on-call write skew, SERIALIZABLE writer participation, and the limits of locking and retry advice on PostgreSQL and MySQL."
---

# Write skew

*Write skew* is the anomaly with no smoking gun: two transactions each *read* an invariant,
each *write* to a *different* row, and both commit. No write-write conflict ever happens.
The rows they touched don't overlap, and the invariant both of them checked is broken
anyway.

The canonical example: a hospital requires at least one doctor on call. Alice and Bob, both
on call, each request the night off. Each transaction checks "is anyone else on call?" (sees
the other) and proceeds:

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

The linked on-call schedule is classified G2-item. No separate predicate G2 schedule is executed here. Snapshot-based REPEATABLE READ can't
catch it: each transaction's snapshot really did contain another doctor, each UPDATE touched
a different row, so there is nothing for a write-conflict check to object to. The decision
each transaction made was invalidated by the *other's write*: a read-write dependency, not a
write-write one.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| REPEATABLE READ | *(not addressed)* | **happens** ([proof](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew)) | **happens** ([proof](/mysql/02-isolation/serializable#write-skew-at-repeatable-read)) |
| SERIALIZABLE | serial equivalence | D: B's `40001` at COMMIT in [this schedule](/postgres/02-isolation/serializable#the-same-interleaving-serializable) | D: B's `1213` with detection enabled in [this schedule](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |

The existing timeline is illustrative. The linked PostgreSQL schedule observes B's 40001 at COMMIT; SSI can also reject earlier, and write/table locks still exist. InnoDB's explicit SERIALIZABLE transaction retains shared read locks and the shown enabled detector rejects B with 1213. Standalone autocommit SELECT is an exception. Neither victim nor instantaneous detection nor eventual retry success is universal.

† Serial equivalence protects this rule only if each transaction preserves it serially and every relevant writer participates; see the [engine catalogs' derivations](/concepts/anomalies-by-engine). Another suitable coordination protocol can protect a rule below SERIALIZABLE. Locking only the different rows each writer changes is insufficient; scanned predicates, missing rows, and cooperating writers need explicit design. Retry all reads/decisions with a bound or return controlled failure. External effects remain outside that database boundary.

## Related anomalies

- [Lost update](/concepts/lost-update), the single-row special case: there the two writes
  *do* overlap, which is why weaker mechanisms can catch it.
- [Read-only anomaly](/concepts/isolation-anomalies#the-read-only-anomaly), write skew's
  strangest consequence: even a transaction that writes nothing can observe an impossible
  state.

## See it happen

- [PostgreSQL: Serializable](/postgres/02-isolation/serializable), write skew at REPEATABLE
  READ, then the same interleaving under SSI
- [MySQL: Serializable](/mysql/02-isolation/serializable), the same invariant dying, then
  saved by shared locks and a deadlock
