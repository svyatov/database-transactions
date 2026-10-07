# Retrying serialization failures

[Repeatable Read](/postgres/02-isolation/repeatable-read) can reject
conflicting updates; [Serializable](/postgres/02-isolation/serializable)
also detects serialization conflicts. Neither substitutes for application
constraints. PostgreSQL 18's [recovery contract](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)
requires a complete transaction retry for `40001`, including decisions
about SQL and values.

<<< ../../../scenarios/postgres/05-patterns/retry-serialization-failures.ts#helper{ts}

The example forces one REPEATABLE READ concurrent-update failure. Its
callback rolls back the failed transaction and then starts a fresh one:

<<< ../../../scenarios/postgres/05-patterns/retry-serialization-failures.ts#demo{ts}

<!--@include: ./parts/retry-serialization-failures.md-->

The assertions require two attempts and a final balance of 115, preserving
A's deposit of 10 and B's deposit of 5. This is Demonstrated behavior for
one forced conflict; later retries can conflict again or fail for another
reason. Eventual success is not guaranteed.

## Retry the transaction, not the statement

Start with a fresh BEGIN, reread, and recompute. The shown callback cleans
up its expected first failure; `withRetry` itself does not begin, roll
back, or commit transactions. Its default cap is five attempts, without
backoff. Other errors and exhaustion propagate. The caller must end any
failed block and report a failure it cannot recover from.

The manual also permits retry for [deadlocks (`40P01`)](/postgres/03-locking/deadlocks),
but this helper retries only `40001`. No deadlock or exhaustion case is
executed here. External effects in a retried callback can repeat, and a
database rollback cannot undo them. The
[idempotency example](/postgres/05-patterns/idempotency) protects database-local
work only; use a separate effect protocol for external work.

## Further reading

- [PostgreSQL 18: Serialization Failure Handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)
- [The same lesson on MySQL](/mysql/05-patterns/retrying-deadlocks)
