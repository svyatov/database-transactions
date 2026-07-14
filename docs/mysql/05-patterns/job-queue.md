# A job queue on `FOR UPDATE SKIP LOCKED`

The pattern that used to require Redis: a correct, crash-safe job queue in plain SQL.
MySQL 8.0 added the missing keyword:
[per the manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html), "a
locking read that uses `SKIP LOCKED` never waits to acquire a row lock. The query executes
immediately, removing locked rows from the result set."

That's the whole trick: a claimed job is a *locked row*, and competing workers don't see
it. No `claimed_by` column to reset after crashes, no heartbeat table. The row lock is
the claim, and it lives exactly as long as the worker's transaction:

<!--@include: ./parts/job-queue.md-->

## Why each piece matters

Every keyword in that claim query is load-bearing. `FOR UPDATE` is the claim itself: the
row stays visible to plain SELECTs, since readers work off
[the snapshot](/mysql/04-mvcc/read-views), but any competing *locking* read has to reckon
with the lock. `SKIP LOCKED` is the part that refuses to wait. Drop it and worker B
queues up behind worker A [in the lock queue](/mysql/03-locking/lock-queues) instead of
grabbing the next job, and your queue serializes down to one effective worker. The
`ORDER BY id LIMIT 1` is fairness and determinism: oldest job first.

Crash safety comes for free. B's "crash" in the transcript is nothing more than a
ROLLBACK, and because the claim was a lock, it evaporated with the transaction and the job
dropped straight back into the queue, [the same guarantee PostgreSQL gives you](/postgres/05-patterns/job-queue).

The manual spells out the trade-off: "Queries that skip locked rows return an inconsistent view of the
data. `SKIP LOCKED` is therefore not suitable for general transactional work. However, it
may be used to avoid lock contention when multiple sessions access the same queue-like
table." That's exactly the design here: for a queue, *not seeing claimed jobs* isn't
inconsistency, it's the point.

One InnoDB-specific note: run workers at READ COMMITTED if you see deadlocks between
claimers. At REPEATABLE READ the locking read can take
[gap locks](/mysql/03-locking/gap-locks) on the index ranges it scans, and two workers'
ranges can overlap.

The whole worker fits in one transaction: claim with
`SELECT … WHERE state = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`, do the work,
`UPDATE … SET state = 'done'`, and `COMMIT`. Keep that transaction short, because the claim
holds a row lock for its entire life, and a worker that wanders off mid-job is a job nobody
else can touch until it commits or dies. Crash safety is the payoff for that discipline: a
dead worker's claim was only ever a lock, and locks don't outlive their transaction.

## Further reading

- [MySQL docs: Locking Read Concurrency with NOWAIT and SKIP LOCKED](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/job-queue)
