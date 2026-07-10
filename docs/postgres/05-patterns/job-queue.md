# A job queue on `FOR UPDATE SKIP LOCKED`

You probably don't need a message broker — the database you already have runs a correct,
crash-safe job queue in about five lines of SQL. Chapter 3 proved the primitive
([SKIP LOCKED](/postgres/03-locking/nowait-skip-locked): workers grab different rows without
waiting); this lesson assembles the full worker loop around it and proves the two
guarantees a queue lives or dies by: no job runs twice, and no job is lost.

The whole trick is doing *claim → work → mark done* inside a single transaction:

<!--@include: ./parts/job-queue.md-->

Both guarantees fall out of things this site already proved. Take double-processing
first: the claim is a [row lock](/postgres/03-locking/row-locks), and `SKIP LOCKED` makes
every other worker pass over claimed jobs instead of queueing behind them. The manual
endorses exactly this use — skipping locked rows
["provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table"](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) —
and the queue is the one place where "inconsistent" is precisely what you want.

Lost jobs are the mirror image. B never wrote `state = 'running'` anywhere; its claim
*was* its uncommitted transaction. When the worker dies,
[atomicity](/postgres/01-basics/what-is-a-transaction) rolls the claim back and the job is
instantly visible to the next `SELECT`. Crash recovery isn't a feature you build — it's
`ROLLBACK`.

## The transaction is the lease

The transaction is the lease, and that's the thing to watch. A worker holds its
connection and its transaction open for the whole job — fine for seconds, wrong for
hours, because a [long transaction](/postgres/04-mvcc/long-transactions) pins VACUUM for
the entire database, and this very queue's table then
[grows with everything it drains](/postgres/07-pitfalls/queue-bloat) until the worker
lets go. For slow jobs, switch to a claimed-state design:
`UPDATE ... SET state = 'running', claimed_at = now()` in one short transaction, plus a
reaper for stale claims. That trades this lesson's automatic crash safety for bounded
transaction time. The other detail is cheap: `ORDER BY id` keeps the queue fair (oldest
first) and the transcripts deterministic, and an index on the queue predicate keeps
`SELECT`s cheap once the table grows.

Strip it to a sentence: claim with `SELECT ... FOR UPDATE SKIP LOCKED`, work, mark done,
commit — and both guarantees are structural, not code you maintain, because a crash is a
`ROLLBACK` and a `ROLLBACK` is a requeue. Keep jobs short; when you can't, claim by state
and accept that you now own stale-claim reaping. This exact loop returns in chapter 6,
where the [transactional outbox](/postgres/06-distributed/transactional-outbox)'s relay is
a SKIP LOCKED worker pointed at an events table.

## Further reading

- [PostgreSQL docs: The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [The same lesson on MySQL](/mysql/05-patterns/job-queue)
