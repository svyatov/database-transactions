# Deadlocks

A lock deadlock is a cycle of conflicting requests: A waits for B while B waits for A. PostgreSQL 18 [detects such cycles and aborts one transaction](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-DEADLOCKS), reporting `40P01`. Do not depend on which transaction becomes the victim.

## Two transfers, opposite directions

A locks alice's row and B locks bob's. Each then updates the other's row. This schedule sets A's `deadlock_timeout` to 10 seconds and B's to 50 milliseconds to make B the observed victim:

<!--@include: ./parts/deadlock.md-->

[`deadlock_timeout`](https://www.postgresql.org/docs/18/runtime-config-locks.html#GUC-DEADLOCK-TIMEOUT) controls how long a backend waits on a lock before checking for a deadlock, not a guaranteed minimum duration for every cycle. Its default is one second; the demonstration overrides it. Detection and scheduling latency are not benchmarked here.

## The cure: lock in a consistent order

In this second schedule both transfers lock rows 1 and 2 in id order before changing either balance. B waits for A and then both transfers commit:

<!--@include: ./parts/deadlock-avoidance.md-->

† For this two-row workload, if every participant takes its strongest required row locks in the same order and holds no other conflicting resources, the opposite-order cycle cannot form: a waiter on row 1 cannot already hold row 2 against the holder of row 1. This is an Entailed guarantee from the [locking contract](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-DEADLOCKS), not a proof of all possible schedules. Other tables, triggers, foreign-key checks, or lock upgrades can introduce other cycles.

After `40P01`, roll back and, where the application permits it, retry the whole transaction with fresh decisions. The demonstrated victim's database changes do not commit. External effects and eventual retry success are not established. The [monitoring lesson](/postgres/03-locking/monitoring-locks) shows how to inspect waits.

## Further reading

- [PostgreSQL 18: Deadlocks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-DEADLOCKS)
- [PostgreSQL 18: deadlock_timeout](https://www.postgresql.org/docs/18/runtime-config-locks.html#GUC-DEADLOCK-TIMEOUT)
- [The same lesson on MySQL](/mysql/03-locking/deadlocks)
