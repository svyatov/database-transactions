# Serializable

You got here from REPEATABLE READ, where your snapshot never shifts mid-transaction, so a shared
invariant should be safe. It isn't. Two doctors are on call. Two transactions each check that at
least one is still on call, each see two, and each take their own doctor off. Different rows, so
nothing conflicts; both commit; the ward is now empty. No single transaction did anything wrong.
That's [write skew](/concepts/write-skew), and nothing weaker than SERIALIZABLE stops it.

SERIALIZABLE is the strongest level, and the one with a mental model you can actually hold: if
every transaction runs SERIALIZABLE and commits, the result is guaranteed to equal *some*
one-at-a-time execution of them. You reason about each transaction on its own and let the database
guarantee the combination.

PostgreSQL implements this as *Serializable Snapshot Isolation* (SSI): REPEATABLE READ snapshots
plus tracking of the read/write dependencies between concurrent transactions. When a pattern
appears that could produce a non-serializable outcome, it aborts one transaction with SQLSTATE
`40001`: keep it, retry it, done.

## Why REPEATABLE READ isn't enough: write skew

Here's that on-call invariant as a live run at REPEATABLE READ. Two transactions, two different
rows, both commit, and the rule they both checked is broken, with no error raised to warn you:

<!--@include: ./parts/write-skew-rr.md-->

## The same interleaving, SERIALIZABLE

<!--@include: ./parts/write-skew-serializable.md-->

## It even protects read-only transactions

The strangest anomaly in this chapter: at REPEATABLE READ, a read-only report can observe
a state that no serial ordering of the transactions could ever produce: the numbers it
printed become retroactively wrong. Under SERIALIZABLE, PostgreSQL aborts the writer that
would invalidate the already-committed report:

<!--@include: ./parts/read-only-anomaly.md-->

## Living with SERIALIZABLE

::: warning A swallowed `40001` is a lost write
Logging a serialization failure and moving on means the transaction never happened.
`40001` is not an error to report; it's an instruction to retry.
:::

Retries aren't optional at this level. Any serializable transaction, even a read-only one, can be
aborted with `40001`, so your application has to retry, and
[a small wrapper makes that painless](/postgres/05-patterns/retrying-serialization-failures). Some
of those aborts are false positives: SSI's dependency tracking is deliberately conservative and
will occasionally cancel a transaction that would have been fine. The
[manual](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE) notes
that when memory pressure forces page-level predicate locks to combine into relation-level ones,
"an increase in the rate of serialization failures may occur". A false positive costs you a
retry, never correctness.

Keep transactions short and small for the same reason. Dependency tracking is bounded by
[`max_pred_locks_per_transaction`](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-MAX-PRED-LOCKS-PER-TRANSACTION)
and its `_per_relation` and `_per_page` siblings, and long transactions and sequential scans
widen the conflict surface. For read-only work that must never be aborted or drag others down,
`BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE` may block while it acquires a safe
snapshot, then runs "without any risk of contributing to or being canceled by a serialization
failure". The manual calls it
["well suited for long-running reports or backups"](https://www.postgresql.org/docs/current/sql-set-transaction.html).

The trade in one breath: SERIALIZABLE is REPEATABLE READ plus dependency monitoring rather than
locks, so readers still never block writers, and it's the only level that stops write skew and
the read-only anomaly on its own. Invariants that span multiple rows are safe here, or with the
explicit locking of the next chapter, and nowhere weaker. Design for `40001` from the first day:
retry loops, idempotent transaction bodies, and no side effects like emails or HTTP calls inside
the transaction.

## Further reading

- [PostgreSQL docs: Serializable Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE)
- [PostgreSQL wiki: SSI examples](https://wiki.postgresql.org/wiki/SSI): the source of the
  deposit-report example above
- Ports & Grittner, [*Serializable Snapshot Isolation in PostgreSQL*](https://arxiv.org/abs/1208.4179)
  (VLDB 2012): the paper behind PostgreSQL's SSI implementation
- [The same lesson on MySQL](/mysql/02-isolation/serializable)
