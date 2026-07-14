# Retrying deadlocks

On PostgreSQL the transient error you retry is
[SQLSTATE `40001`](/postgres/05-patterns/retrying-serialization-failures). On MySQL it's
[errno `1213`](/mysql/03-locking/deadlocks), a deadlock victim. Different mechanism, same
contract: the database rolled your transaction back not because it was wrong, but because
it collided with another one. Run it again and it will very likely succeed.

The manual is unambiguous
([How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)):
"Always be prepared to re-issue a transaction if it fails due to deadlock. Deadlocks are
not dangerous. Just try again."

The helper is a dozen lines:

<<< ../../../scenarios/mysql/05-patterns/retry-deadlocks.ts#helper{ts}

And here it is earning its keep. The scenario forces the classic opposite-order deadlock
on the first attempt, hands the `1213` to `withRetry`, and proves the second attempt
succeeds:

<<< ../../../scenarios/mysql/05-patterns/retry-deadlocks.ts#demo{ts}

<!--@include: ./parts/retry-deadlocks.md-->

## What must be inside the retry

The same rule as PostgreSQL's: re-run the whole transaction, including the application
logic: every read, every decision, every computed value. The first attempt's reads are
void, and reusing any of them re-introduces the stale-read bug you're recovering from. In
the scenario, attempt 2 re-runs both UPDATEs from the top.

Two MySQL-specific cautions come with this. First, don't retry
[errno `1205`](/mysql/03-locking/nowait-skip-locked) the way you retry `1213`: a lock-wait
timeout rolls back only the *statement*, so your transaction stays open and keeps holding
its locks. Blindly re-running the whole function on `1205` double-applies whatever already
succeeded, so roll back first, then retry.

Second, SERIALIZABLE multiplies deadlocks. InnoDB's SERIALIZABLE
[detects conflicts via locks](/mysql/02-isolation/serializable), so the errors your retry
loop meets at that level are these same `1213`s. Budget for more of them.

The mental model is short: `1213` means "collided", not "failed", so you retry the whole
transaction with fresh reads and all. Cap the attempts and log exhaustion, because a hot
row can starve a naive infinite loop. And keep `1205` in its own lane: ROLLBACK first,
since a statement-level rollback leaves the transaction open, then retry.

## Further reading

- [MySQL docs: Deadlock Detection and Rollback](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html)
- [MySQL docs: How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
- [The PostgreSQL counterpart: retrying `40001`](/postgres/05-patterns/retrying-serialization-failures)
