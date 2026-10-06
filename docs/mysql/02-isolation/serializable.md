# Serializable

A cross-row business rule can fail even when concurrent transactions write
different rows. These MySQL 8.4.11 InnoDB Scenarios use the rule that at least
one doctor stays on call. Each request counts two doctors and removes a different
one. Each request would preserve the rule if it ran alone from that state.

## Write skew at REPEATABLE READ

Both requests commit in the displayed snapshot-read schedule. The final count
is zero. This demonstrates item write skew (G2-item), not every predicate anomaly.

<!--@include: ./parts/write-skew-rr.md-->

## SERIALIZABLE stops it (with locks)

The [MySQL 8.4 SERIALIZABLE contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_serializable)
uses shared locking reads for plain SELECTs in explicit multi-statement
transactions, as executed here, or when autocommit is disabled. Lock coverage
depends on the query and index, including relevant ranges, not just returned rows.
A's UPDATE waits for B; B's UPDATE closes the cycle. With deadlock detection
enabled, this schedule selects B as victim (1213), A commits, and one doctor remains.
The victim and detection timing are not universal guarantees.

<!--@include: ./parts/write-skew-serializable.md-->

The fresh B attempt repeats the count and declines to leave. Retry the whole
transaction with fresh reads and decisions, or return a controlled failure.
A successful retry is not guaranteed. The
[error-handling contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)
says deadlocks roll back the entire transaction. With
[deadlock detection disabled](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html),
lock-wait timeouts can resolve the cycle instead; their rollback scope depends
on `innodb_rollback_on_timeout`. These configuration alternatives are not executed here.

::: info Two databases, different conflict handling
PostgreSQL's [SSI example](/postgres/02-isolation/serializable) detects this
dependency conflict without the count SELECTs taking InnoDB-style row locks.
PostgreSQL SERIALIZABLE can still wait for ordinary conflicting writes or locks,
and 40001 is not confined to COMMIT. InnoDB deadlocks are not confined to SERIALIZABLE.
:::

::: warning Not every SERIALIZABLE SELECT locks
A standalone autocommit SELECT can be a nonlocking consistent read. The final
part of this Scenario asserts that it reads the last committed on-call count
during B's uncommitted change. With autocommit disabled, the same SELECT waits
until B rolls back. Applying a session level does not combine separate
autocommit statements into one protected read-modify-write transaction.
:::

**Entailed guarantee:** for this rule, if every relevant request uses the
SERIALIZABLE transaction boundary and checks the count before removing a doctor,
the locking read prevents a competing removal from silently invalidating that
decision before commit. A serial execution of the requests preserves at least
one doctor; waits or aborted attempts must be handled without reporting a commit.
This derivation uses the manual's locking-read and SERIALIZABLE contracts, not
just the observed count of one. Other writers that bypass the check can still
break the rule. Suitable explicit coordination can also protect it; SERIALIZABLE
is not the only possible repair, and no cost comparison is measured here.

## Further reading

- [MySQL 8.4: Locks Set by Different SQL Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
- [MySQL 8.4: Deadlock Detection](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html)
- [The same lesson on PostgreSQL](/postgres/02-isolation/serializable)
