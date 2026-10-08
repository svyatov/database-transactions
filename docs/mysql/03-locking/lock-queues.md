# Lock queues

In this MySQL 8.4 InnoDB schedule, two UPDATE statements wait for a transaction holding
the same primary-key record. `sys.innodb_lock_waits` identifies B's blocker. After A commits,
both updates complete and the asserted balance is 211.

## Watch the pile-up

<!--@include: ./parts/lock-queue.md-->

## Grant order: don't bet on FIFO

The [transaction scheduling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-scheduling.html)
documents CATS weights using "the number of transactions that a transaction blocks" and
states: "If weights are equal, priority is given to the longest waiting transaction."
This contract applies to transactions waiting for locks on the same object. It is not established by the
transcript, which checks completion and final state without asserting grant order.

Do not build application ordering or eventual-completion promises on that schedule.
A wait can end with a [timeout](/mysql/03-locking/nowait-skip-locked),
[deadlock](/mysql/03-locking/deadlocks), cancellation, or connection loss.
Shorten the holding transaction, reduce contention, or choose an appropriate
`NOWAIT`/`SKIP LOCKED` policy. See [monitoring locks](/mysql/03-locking/monitoring-locks).

## Further reading

- [MySQL docs: The innodb_lock_waits View](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The PostgreSQL counterpart](/postgres/03-locking/lock-queues)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
