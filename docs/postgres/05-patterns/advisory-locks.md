# Advisory locks: locking ideas, not rows

Every lock so far protected a row or a table. But some things worth serializing aren't
stored anywhere: "the nightly report is running", "this cron job", "migrations are in
progress". PostgreSQL has a lock type for exactly this —
["a means for creating locks that have application-defined meanings"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).
You pick a number; PostgreSQL guarantees only one session holds it; what the number
*means* is entirely your business.

<!--@include: ./parts/advisory-locks.md-->

`pg_try_advisory_lock` is the shape most jobs want: *"someone else is already doing this —
exit 0"* beats a pile of cron runners queueing up to do the same work again.

## Session locks vs. transaction locks

The scenario's second half is the part that pages people. A session-level lock, in the
manual's words,
["is held until explicitly released or the session ends"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) —
`COMMIT` does nothing to it. It gets stranger: session-level advisory locks
["do not honor transaction semantics: a lock acquired during a transaction that is later rolled back will still be held following the rollback"](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).
`pg_advisory_xact_lock` restores the semantics you expect from everything else in this
site: taken inside a transaction, released automatically at its end, no unlock function
even exists.

These locks fit anywhere you need to serialize work rather than data: cron mutual
exclusion, migration guards, one worker per tenant. Default to `pg_advisory_xact_lock`
and let `COMMIT` clean up after you; reach for a session-level lock only when the
protected work genuinely spans transactions, and then treat its explicit unlock as
seriously as a `finally` block. Disconnecting releases everything a session holds, so a
crashed holder can't strand a lock, and `pg_try_advisory_lock` stays the polite option
for "skip if busy" work: it answers instead of queueing.

One sharp edge is worth a registry entry: the lock key is a global name. Numbers come in
two separate spaces — a single 64-bit key, or a pair of 32-bit keys, which the manual
notes ["do not overlap"](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS) —
but within whichever space you standardize on, two features that pick the same number
will silently exclude each other. Keep a registry of who owns which key.

## Further reading

- [PostgreSQL docs: Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [PostgreSQL docs: Advisory Lock Functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [The same lesson on MySQL](/mysql/05-patterns/advisory-locks)
