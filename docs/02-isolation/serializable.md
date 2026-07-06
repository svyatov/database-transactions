# Serializable

SERIALIZABLE is the strongest level and the only one with a simple mental model: **if all your
transactions run SERIALIZABLE and commit, the result is guaranteed to equal *some* one-at-a-time
execution of them.** You reason about each transaction alone; the database guarantees the
combination.

PostgreSQL implements this as *Serializable Snapshot Isolation* (SSI): REPEATABLE READ
snapshots, plus tracking of read/write dependencies between concurrent transactions. When a
pattern arises that could produce a non-serializable outcome, one transaction is aborted with
SQLSTATE `40001` — keep it, retry it, done.

## Why REPEATABLE READ isn't enough: write skew

Two transactions each check an invariant ("at least one doctor on call"), each update a
*different* row, and both commit. No write-write conflict ever happens — and the invariant
still breaks:

<<< ../../scenarios/02-isolation/write-skew-rr.ts#demo{ts}

<!--@include: ./parts/write-skew-rr.md-->

## The same interleaving, SERIALIZABLE

<<< ../../scenarios/02-isolation/write-skew-serializable.ts#demo{ts}

<!--@include: ./parts/write-skew-serializable.md-->

## It even protects read-only transactions

The strangest anomaly in this chapter: at REPEATABLE READ, a **read-only report** can observe
a state that no serial ordering of the transactions could ever produce — the numbers it
printed become retroactively wrong. Under SERIALIZABLE, PostgreSQL aborts the writer that
would invalidate the already-committed report:

<<< ../../scenarios/02-isolation/read-only-anomaly.ts#rr{ts}

<<< ../../scenarios/02-isolation/read-only-anomaly.ts#serializable{ts}

<!--@include: ./parts/read-only-anomaly.md-->

## The fine print

- **Retries are part of the deal.** Any serializable transaction — even a read-only one — can
  be aborted with `40001`. Your application must retry; a small wrapper makes this painless
  (patterns chapter, coming).
- **False positives exist.** SSI's dependency tracking is conservative; it sometimes aborts
  transactions that would have been fine. That's a performance cost, never a correctness bug.
- **Keep transactions short and small.** Dependency tracking is bounded by
  `max_pred_locks_per_transaction`; long transactions and sequential scans widen the
  conflict surface.
- For read-only work that must never be aborted *or* contribute to aborting others:
  `BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE` — it may wait for a safe snapshot
  before starting, then runs with zero serialization risk.

## Key takeaways

- SERIALIZABLE = REPEATABLE READ + dependency monitoring, not locks. Readers still don't
  block writers.
- It is the only level that stops write skew and the read-only anomaly — invariants enforced
  across *multiple rows* are only safe here (or with explicit locking, next chapter).
- Design for `40001` from day one: retry loops, idempotent transaction bodies, no
  side effects (emails, HTTP calls) inside the transaction.

## Further reading

- [PostgreSQL docs: Serializable Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE)
- [PostgreSQL wiki: SSI examples](https://wiki.postgresql.org/wiki/SSI) — the source of the
  deposit-report example above
