# Lock queues

A lock that's taken is only half the story. The other half is the queue that forms behind it,
because that queue, not the lock itself, is what turns one slow transaction into a site-wide
incident. You'll see the extreme version in [DDL outages](/postgres/03-locking/table-locks-and-ddl);
here's the mechanism on a single hot row.

## First come, first locked

<!--@include: ./parts/lock-queue-fifo.md-->

## Reading the transcript

Two details in `M`'s output are worth a second look.

The first: `C` waits on `B`, not on `A`. When `B` joined the queue it claimed a *tuple lock* (its ticket for first place in line) and only then settled in to wait for A's transaction to
end. Everyone who arrives after `B` queues on that tuple lock, so the wait relationships form a
chain, not a star. To find the transaction that's actually holding things up you may have to
walk several hops (the [monitoring lesson](/postgres/03-locking/monitoring-locks) has the query).

The second: `pg_blocking_pids()` does the hard walk for you. It answers "who is this backend
waiting for?" directly, including sessions that merely wait ahead in the queue rather than
holding a conflicting lock outright. The manual calls those
[soft blocks](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION).
No manual `pg_locks` archaeology required.

The rule underneath all of this is arrival order. When a row lock is released it goes to the
head of the queue, and everyone else keeps waiting behind the new holder. That's why queue time
compounds: three 100 ms transactions serialized on one row take 300 ms, and a genuinely hot row
(a counter, an account balance, a "singleton" config row) is a throughput ceiling by design.
When you need to see a pile-up as it happens, `pg_stat_activity.wait_event_type = 'Lock'` paired
with `pg_blocking_pids()` is the fastest look, which is exactly where the
[monitoring lesson](/postgres/03-locking/monitoring-locks) picks up.

## Further reading

- [PostgreSQL docs: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL docs: `pg_blocking_pids()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION)
- [The same lesson on MySQL](/mysql/03-locking/lock-queues)
