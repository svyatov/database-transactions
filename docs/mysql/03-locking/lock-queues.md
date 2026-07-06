# Lock queues

When a row lock is taken, later writers don't fail — they **wait**. Under load, waiters pile
up behind one holder, and the pile-up itself is visible live in `sys.innodb_lock_waits`.

## Watch the pile-up

<<< ../../../scenarios/mysql/03-locking/lock-queue.ts#demo{ts}

<!--@include: ./parts/lock-queue.md-->

## Grant order: don't bet on FIFO

PostgreSQL grants a released lock strictly to
[the first waiter in line](/postgres/03-locking/lock-queues). InnoDB since 8.0.20 uses
**CATS** (Contention-Aware Transaction Scheduling): waiters are weighted by how many other
transactions they in turn block, and the "most blocking" waiter can jump the queue. Under
light load it usually looks FIFO — but it's a scheduling heuristic, not a promise. Never
build ordering guarantees on lock-grant order.

## Key takeaways

- A blocked writer is invisible to the application until it's too late — monitor
  `sys.innodb_lock_waits` ([monitoring lesson](/mysql/03-locking/monitoring-locks)).
- Every queued update lands eventually (assuming no
  [timeout](/mysql/03-locking/nowait-skip-locked) or
  [deadlock](/mysql/03-locking/deadlocks)) — but the *order* is up to the scheduler.
- One slow transaction holding a hot row turns into N stuck sessions. The fixes:
  shorter transactions, or don't wait at all — `NOWAIT` / `SKIP LOCKED`
  ([next lesson](/mysql/03-locking/nowait-skip-locked)).

## Further reading

- [MySQL docs: Transaction Scheduling (CATS)](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-scheduling.html)
- [MySQL docs: The innodb_lock_waits and x$innodb_lock_waits Views](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
