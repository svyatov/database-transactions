# Retrying serialization failures

[Repeatable Read](/02-isolation/repeatable-read) and
[Serializable](/02-isolation/serializable) keep your data consistent by *rejecting*
transactions they can't fit into a consistent story — SQLSTATE `40001`. The manual is
blunt about whose job the recovery is:
["Applications using this level must be prepared to retry transactions due to serialization failures."](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)

So every application running above READ COMMITTED needs one small piece of
infrastructure — a retry loop:

<<< ../../scenarios/05-patterns/retry-serialization-failures.ts#helper{ts}

And here it is earning its keep. The scenario forces a conflict on the first attempt
(A commits a deposit between B's read and B's write), hands the `40001` to `withRetry`,
and proves the second attempt succeeds:

<<< ../../scenarios/05-patterns/retry-serialization-failures.ts#demo{ts}

<!--@include: ./parts/retry-serialization-failures.md-->

Attempt 1 computed `100 + 5` and died; attempt 2 read the world as it actually was —
`110` — and wrote `115`. Nothing was lost: A's `+10` and B's `+5` both applied. The
error was never a failure, just PostgreSQL saying *"not in this order — try again."*

## Retry the transaction, not the statement

The retry must restart from `BEGIN`, re-reading everything — the manual:
["It is important to retry the complete transaction, including all logic that decides which SQL to issue and/or which values to use."](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html)
Re-running only the failed UPDATE would write the stale `105` — the exact bug isolation
just prevented. That's also why
["PostgreSQL does not offer an automatic retry facility, since it cannot do so with any guarantee of correctness"](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html):
only the application knows where its transaction's logic begins.

## Key takeaways

- `40001` is **transient by design** — the same transaction, re-run against the new
  state, succeeds. Treat it as control flow, not as an error to page anyone about.
- Retry from the top: new `BEGIN`, fresh reads, recomputed values. Cap the attempts and
  fail loudly when the cap is hit.
- [Deadlocks (`40P01`)](/03-locking/deadlocks) deserve the same treatment — one of the
  two transactions is rolled back precisely so it can be retried.
- Anything non-transactional inside the loop (an email, an HTTP call) will run once per
  attempt — move it out, or make it idempotent
  ([idempotency keys](/05-patterns/idempotency)).

## Further reading

- [PostgreSQL docs: Serialization Failure Handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html)
- [PostgreSQL docs: Repeatable Read Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
