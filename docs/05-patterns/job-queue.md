# A job queue on `FOR UPDATE SKIP LOCKED`

You probably don't need a message broker — the database you already have runs a correct,
crash-safe job queue in about five lines of SQL. Chapter 3 proved the primitive
([SKIP LOCKED](/03-locking/nowait-skip-locked): workers grab different rows without
waiting); this lesson assembles the full worker loop around it and proves its two
guarantees: **no job runs twice, no job is lost**.

The whole trick is doing *claim → work → mark done* inside **one transaction**:

<<< ../../scenarios/05-patterns/job-queue.ts#demo{ts}

<!--@include: ./parts/job-queue.md-->

Both guarantees fall out of things this site already proved:

- **No double-processing.** The claim is a [row lock](/03-locking/row-locks); `SKIP LOCKED`
  makes every other worker pass over claimed jobs instead of queueing behind them. The
  manual endorses exactly this use: skipping locked rows
  ["provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table"](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) —
  the queue is the one place where "inconsistent" is precisely what you want.
- **No lost jobs.** B never wrote `state = 'running'` anywhere — its claim *was* its
  uncommitted transaction. When the worker dies, [atomicity](/01-basics/what-is-a-transaction)
  rolls the claim back and the job is instantly visible to the next `SELECT`. Crash
  recovery isn't a feature you build; it's `ROLLBACK`.

## The fine print

- **The transaction is the lease.** A worker holds its connection and its transaction for
  the whole job — fine for seconds, wrong for hours. A [long transaction](/04-mvcc/long-transactions)
  pins VACUUM for the entire database, so for slow jobs switch to a claimed-state design:
  `UPDATE ... SET state = 'running', claimed_at = now()` in one short transaction, plus a
  reaper for stale claims. That trades this lesson's automatic crash safety for bounded
  transaction time.
- `ORDER BY id` keeps the queue fair (oldest first) and the transcripts deterministic;
  an index on the queue predicate is what keeps `SELECT`s cheap once the table grows.

## Key takeaways

- Claim with `SELECT ... FOR UPDATE SKIP LOCKED`, work, mark done, `COMMIT` — one
  transaction, and both queue guarantees are structural, not code you maintain.
- A worker crash is a `ROLLBACK`, and a `ROLLBACK` is a requeue. Nothing to detect,
  nothing to clean up.
- Keep jobs short. When they can't be, claim by state instead of by lock — and accept
  that you now own stale-claim reaping.

## Further reading

- [PostgreSQL docs: The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
