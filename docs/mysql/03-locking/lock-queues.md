# Lock queues

When a row lock is taken, later writers don't fail; they line up and wait. Under load, waiters
pile up behind one holder, and the pile-up itself is visible live in `sys.innodb_lock_waits`.

## Watch the pile-up

<!--@include: ./parts/lock-queue.md-->

## Grant order: don't bet on FIFO

PostgreSQL grants a released lock strictly to
[the first waiter in line](/postgres/03-locking/lock-queues). InnoDB since 8.0.20 uses
*CATS*, Contention-Aware Transaction Scheduling: each waiter carries a weight computed from how
many other transactions it in turn blocks, and the waiter that blocks the most can jump the
queue. Under light load it usually looks FIFO — but it's a scheduling heuristic, not a promise.
Never build ordering guarantees on lock-grant order.

None of this queue is visible to your application until it's already in trouble, which is why
`sys.innodb_lock_waits` is worth watching ([monitoring locks](/mysql/03-locking/monitoring-locks)) —
it names each waiter and its blocker. Every queued update does land eventually, barring a
[timeout](/mysql/03-locking/nowait-skip-locked) or [deadlock](/mysql/03-locking/deadlocks), but
the order it lands in is the scheduler's call, not yours. One slow transaction on a hot row is
all it takes to turn a healthy system into N stuck sessions, and the fixes come down to two:
shorter transactions, or refusing to wait at all with
[`NOWAIT` and `SKIP LOCKED`](/mysql/03-locking/nowait-skip-locked).

## Further reading

- [MySQL docs: Transaction Scheduling (CATS)](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-scheduling.html)
- [MySQL docs: The innodb_lock_waits and x$innodb_lock_waits Views](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The same lesson on PostgreSQL](/postgres/03-locking/lock-queues)
