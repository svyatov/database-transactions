# Lock queues

Waiting requests can block later requests as well as requests held outright. This schedule follows three updates of one row and observes B completing before C. It does not establish universal FIFO fairness or a throughput bound.

## First come, first locked

<!--@include: ./parts/lock-queue-fifo.md-->

## Reading the transcript

M first observes B and C waiting. After A commits, B's update completes; the runner waits until C is again observed waiting, and M sees C as the remaining waiter. After B commits, C finishes and the asserted balance is 211. The initial observation asserts waiter names, not the contents of `blocked_by`; it does not independently assert the initial B-to-A and C-to-B edges.

[`pg_blocking_pids()`](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION) reports immediate hard blockers (conflicting locks held) and soft blockers (conflicting requests ahead in the queue). It does not recursively return every ancestor. Walk the returned relationships to find the root of a longer chain. The [monitoring lesson](/postgres/03-locking/monitoring-locks) explains a direct-edge query; the [DDL lesson](/postgres/03-locking/table-locks-and-ddl) asserts a two-edge chain.

## Further reading

- [PostgreSQL 18: Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18: pg_blocking_pids()](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION)
- [The same lesson on MySQL](/mysql/03-locking/lock-queues)
