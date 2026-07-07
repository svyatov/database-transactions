# A job queue on FOR UPDATE SKIP LOCKED

The pattern that used to require Redis: a correct, crash-safe job queue in plain SQL.
MySQL 8.0 added the missing keyword —
[per the manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html), "a
locking read that uses `SKIP LOCKED` never waits to acquire a row lock. The query executes
immediately, removing locked rows from the result set."

That's the whole trick: a claimed job is a *locked row*, and competing workers simply
don't see it. No `claimed_by` column to reset after crashes, no heartbeat table — the row
lock **is** the claim, and it lives exactly as long as the worker's transaction:

<!--@include: ./parts/job-queue.md-->

## Why each piece matters

- **`FOR UPDATE`** — the claim. The row stays visible to plain SELECTs (readers use
  [the snapshot](/mysql/04-mvcc/read-views)), but any competing *locking* read must deal
  with the lock.
- **`SKIP LOCKED`** — the "don't wait" part. Without it, worker B queues behind worker A
  [in the lock queue](/mysql/03-locking/lock-queues) instead of taking the next job —
  your queue serializes to one effective worker.
- **`ORDER BY id LIMIT 1`** — fairness and determinism; oldest job first.
- **Crash safety for free** — B's "crash" in the transcript is just ROLLBACK: the claim
  was a lock, so it evaporated with the transaction and the job returned to the queue.
  Compare the same guarantee [on PostgreSQL](/postgres/05-patterns/job-queue).

The manual's warning — "Queries that skip locked rows return an inconsistent view of the
data. `SKIP LOCKED` is therefore not suitable for general transactional work. However, it
may be used to avoid lock contention when multiple sessions access the same queue-like
table" — is exactly the design here: for a queue, *not seeing claimed jobs* isn't
inconsistency, it's the point.

One InnoDB-specific note: run workers at READ COMMITTED if you see deadlocks between
claimers — at REPEATABLE READ the locking read can take
[gap locks](/mysql/03-locking/gap-locks) on the index ranges it scans, and two workers'
ranges can overlap.

## Key takeaways

- Claim = `SELECT … WHERE state = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
  work, `UPDATE … SET state = 'done'`, `COMMIT` — all in one transaction.
- A crashed worker's job re-queues itself: the claim is a lock, and locks die with the
  transaction.
- Keep job transactions short; the claim holds a row lock for its whole duration.

## Further reading

- [MySQL docs: Locking Read Concurrency with NOWAIT and SKIP LOCKED](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/job-queue)
