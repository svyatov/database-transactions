# Deadlocks

A deadlock is the lock queue's dead end: A waits for B while B waits for A. Neither can ever
proceed, so PostgreSQL breaks the tie by force — it detects the cycle and kills one of the
transactions with SQLSTATE `40P01` (`deadlock_detected`).

## Two transfers, opposite directions

<<< ../../../scenarios/postgres/03-locking/deadlock.ts#demo{ts}

<!--@include: ./parts/deadlock.md-->

How the detection works: a backend that has been waiting for `deadlock_timeout` (default
**1 s**) checks whether its wait is part of a cycle — and if so, aborts itself. Two
consequences worth internalizing:

- **Deadlocks cost latency before they cost errors.** Every one burns at least
  `deadlock_timeout` of pure waiting first.
- **The victim is effectively arbitrary** — whoever's timer fires first while the cycle
  exists. The transcript above is only reproducible because we pinned the timers; the manual
  itself says which transaction gets aborted is
  ["difficult to predict and should not be relied upon"](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).
  Write code that survives *either* transaction being the victim.

## The cure: lock in a consistent order

Deadlocks need a cycle, and a cycle needs disagreement about order. Remove the disagreement
and the deadlock is not "less likely" — it's **impossible**:

<<< ../../../scenarios/postgres/03-locking/deadlock-avoidance.ts#demo{ts}

<!--@include: ./parts/deadlock-avoidance.md-->

## Key takeaways

- `40P01` is a retryable error, exactly like `40001`: roll back, retry the whole transaction.
  The other transaction finished fine — your data is consistent.
- The real fix is **consistent lock ordering** (the manual's words: ["the best defense against
  deadlocks is generally to avoid them by being certain that all applications using a database
  acquire locks on multiple objects in a consistent order"](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)):
  sort by primary key before `FOR UPDATE`, always update account pairs in id order, take the
  "parent" lock before the "child". One convention, zero deadlocks.
- Locking everything up front (`SELECT ... WHERE id IN (…) ORDER BY id FOR UPDATE`) turns a
  potential deadlock into a plain queue wait.
- A `deadlock_timeout` of 1 s means deadlock-prone code shows up as **latency spikes** long
  before you notice the errors. Frequent `40P01` in the logs is a design smell, not bad luck.

## Further reading

- [PostgreSQL docs: Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)
- [PostgreSQL docs: `deadlock_timeout`](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-DEADLOCK-TIMEOUT)
