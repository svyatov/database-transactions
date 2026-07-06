# Lock queues

A lock that's taken is only half the story. The other half is the **queue** that forms behind
it — because that queue, not the lock itself, is what turns one slow transaction into a
site-wide incident (you'll see the extreme version in
[DDL outages](/03-locking/table-locks-and-ddl)).

## First come, first locked

<<< ../../scenarios/03-locking/lock-queue-fifo.ts#demo{ts}

<!--@include: ./parts/lock-queue-fifo.md-->

## Reading the transcript

Two details in `M`'s output are worth a second look:

- **`C` waits on `B`, not on `A`.** The first waiter (`B`) claims a *tuple lock* — its ticket
  for first place in line — and then waits for A's transaction to end. Everyone after queues
  on that tuple lock. Wait chains are chains, not stars: to find the real culprit you may have
  to walk several hops (the [monitoring lesson](/03-locking/monitoring-locks) has the query).
- **`pg_blocking_pids()` does the hard work for you.** It answers "who is this backend waiting
  for?" directly — including sessions that merely wait *ahead in the queue* (the manual calls
  these [soft blocks](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION)) —
  no manual `pg_locks` archaeology.

## Key takeaways

- Waiters are served **in arrival order** — a row lock released goes to the head of the queue,
  and everyone else keeps waiting behind the new holder.
- Queue time compounds: three 100 ms transactions serialized on one row take 300 ms. Hot rows
  (counters, account balances, "singleton" config rows) are throughput ceilings by design.
- `pg_stat_activity.wait_event_type = 'Lock'` + `pg_blocking_pids()` is the fastest way to see
  a pile-up live.

## Further reading

- [PostgreSQL docs: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL docs: `pg_blocking_pids()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION)
