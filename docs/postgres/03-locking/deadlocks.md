# Deadlocks

A deadlock is the lock queue's dead end: A waits for B while B waits for A. Neither can ever
proceed, so PostgreSQL breaks the tie by force: it detects the cycle and kills one of the
transactions with SQLSTATE `40P01` (`deadlock_detected`).

## Two transfers, opposite directions

The setup is two money transfers going opposite ways. A grabs alice's row, B grabs bob's row,
and then each reaches for the row the other is holding. That reach is the cycle.

```timeline
Session A: UPDATE alice (id=1) → holds alice
Session B: UPDATE bob (id=2) → holds bob
Session A: UPDATE bob (id=2) → ⏳ waits for B
Session B: UPDATE alice (id=1) → ✋ 40P01 — the cycle is detected, B is aborted
Session A: ⏵ UPDATE bob → completes, then COMMIT
```

<!--@include: ./parts/deadlock.md-->

How the detection works: a backend that has been waiting for `deadlock_timeout` (default
1 s) checks whether its wait is part of a cycle, and if so, aborts itself. Two consequences are
worth internalizing. The first is that deadlocks cost latency before they cost errors: every
one burns at least `deadlock_timeout` of pure waiting before anything is aborted. The second is
that the victim is effectively arbitrary: whoever's timer fires first while the cycle exists is
the one that dies. The transcript above is only reproducible because we pinned the timers; the
manual itself says which transaction gets aborted is
["difficult to predict and should not be relied upon"](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).
Write code that survives *either* transaction being the victim.

## The cure: lock in a consistent order

Deadlocks need a cycle, and a cycle needs disagreement about order. Remove the disagreement and
the deadlock isn't "less likely," it's gone entirely:

<!--@include: ./parts/deadlock-avoidance.md-->

`40P01` is retryable, exactly like the `40001` you met under serializable conflicts: roll back
and retry the whole transaction. The other transaction finished fine, so your data is
consistent, nothing to clean up; run yours again.

The real fix, though, isn't retrying faster; it's never forming the cycle. That means
consistent lock ordering, in the manual's own words: ["the best defense against deadlocks is
generally to avoid them by being certain that all applications using a database acquire locks
on multiple objects in a consistent order"](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).
Sort by primary key before `FOR UPDATE`, always update account pairs in id order, take the
"parent" lock before the "child": one convention, zero deadlocks. Locking everything up front
with `SELECT ... WHERE id IN (…) ORDER BY id FOR UPDATE` turns a potential deadlock into a plain
queue wait.

One last thing to watch for: because `deadlock_timeout` is a full second, deadlock-prone code
shows up as latency spikes long before you notice the errors. Frequent `40P01` in the logs is a
design smell, not bad luck. The [monitoring lesson](/postgres/03-locking/monitoring-locks) shows
how to catch the wait before the timer fires.

## Further reading

- [PostgreSQL docs: Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)
- [PostgreSQL docs: `deadlock_timeout`](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-DEADLOCK-TIMEOUT)
- [The same lesson on MySQL](/mysql/03-locking/deadlocks)
