# Retrying deadlocks

An InnoDB deadlock victim receives [errno `1213`](/mysql/03-locking/deadlocks). The [MySQL 8.4 error-handling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html) states: "`InnoDB` rolls back the entire transaction. Retry the entire transaction when this happens." A new attempt can also fail, so bound the attempts rather than promise success.

The helper retries only `1213`, with five attempts by default. It assumes each call owns the complete InnoDB transaction and propagates the normalized driver error. It is not a cleanup wrapper for other errors:

<<< ../../../scenarios/mysql/05-patterns/retry-deadlocks.ts#helper{ts}

The first attempt forces an opposite-order deadlock. The victim's second attempt runs both UPDATEs again in a new transaction, after the survivor commits. The scenario asserts two attempts and final balances 115 and 85:

<<< ../../../scenarios/mysql/05-patterns/retry-deadlocks.ts#demo{ts}

<!--@include: ./parts/retry-deadlocks.md-->

## What must be inside the retry

Re-run the complete transaction and its decisions from fresh reads, not only the statement that found the deadlock. Keep external effects out of a blindly replayed callback; rollback cannot undo a remote operation. The [outbox lesson](/mysql/06-distributed/transactional-outbox) explains that boundary. Retry exhaustion and non-`1213` errors propagate to the caller, which must handle the applicable transaction state. The demonstrated scenario exercises the successful second attempt, not every exhaustion or cleanup path.

[Errno `1205`](/mysql/03-locking/nowait-skip-locked) has a different scope. With `innodb_rollback_on_timeout=OFF`, the default, a row-lock timeout rolls back the waiting statement, not the whole transaction, as documented in the [error-handling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html). If you choose a whole-transaction retry, explicitly roll back first. With `innodb_rollback_on_timeout=ON`, the whole transaction is rolled back. Other errors require their own classification; do not pass all of them through the deadlock rule.

[SERIALIZABLE](/mysql/02-isolation/serializable) can produce `1213` through conflicting locks. This lesson does not measure its deadlock rate or promise eventual success under persistent contention. Limit attempts, log exhaustion, and choose application backoff separately; the helper shows the bounded replay mechanism without a backoff policy.

## Further reading

- [MySQL docs: InnoDB Error Handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)
- [MySQL docs: How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
- [The PostgreSQL counterpart: retrying `40001`](/postgres/05-patterns/retrying-serialization-failures)
