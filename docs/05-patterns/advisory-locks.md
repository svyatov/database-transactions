# Advisory locks: locking ideas, not rows

Every lock so far protected a row or a table. But some things worth serializing aren't
stored anywhere: "the nightly report is running", "this cron job", "migrations are in
progress". PostgreSQL has a lock type for exactly this —
["a means for creating locks that have application-defined meanings"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).
You pick a number; PostgreSQL guarantees only one session holds it; what the number
*means* is entirely your business.

<<< ../../scenarios/05-patterns/advisory-locks.ts#demo{ts}

<!--@include: ./parts/advisory-locks.md-->

`pg_try_advisory_lock` is the shape most jobs want: *"someone else is already doing this —
exit 0"* beats a pile of cron runners queueing up to do the same work again.

## Session locks vs. transaction locks

<<< ../../scenarios/05-patterns/advisory-locks.ts#session-vs-xact{ts}

The scenario's second half is the part that pages people. A **session-level** lock
["is held until explicitly released or the session ends"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) —
`COMMIT` does nothing to it. It gets stranger: session-level advisory locks
["do not honor transaction semantics: a lock acquired during a transaction that is later rolled back will still be held following the rollback"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).
`pg_advisory_xact_lock` restores the semantics you expect from everything else in this
site: taken inside a transaction, released automatically at its end, no unlock function
even exists.

## Key takeaways

- Advisory locks serialize **application-defined work** with zero tables: perfect for
  cron mutual exclusion, migration guards, "one worker per tenant".
- Default to `pg_advisory_xact_lock` — commit-and-forget. Reach for session-level locks
  only when the protected work genuinely spans transactions, and treat the explicit
  unlock as seriously as a `finally` block. (Disconnecting releases everything — a
  crashed holder can't strand a lock.)
- `pg_try_advisory_lock` answers instantly instead of queueing — the polite option for
  "skip if busy" jobs.
- All advisory locks share **one global number space** (a single 64-bit key, or two
  32-bit keys). Two features using the same number will exclude each other; keep a
  registry of who owns which key.

## Further reading

- [PostgreSQL docs: Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [PostgreSQL docs: Advisory Lock Functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
