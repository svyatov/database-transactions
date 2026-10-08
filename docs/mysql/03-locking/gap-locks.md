# Gap locks: locking rows that don't exist

In MySQL 8.4 InnoDB, a gap lock prevents insertion into an index gap. A next-key lock
combines a record lock with the preceding gap. The
[locking manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html) documents these mechanisms.
They are not locks on an abstract SQL predicate independent of the access path.

## An INSERT blocked by a SELECT

The scenario scans `bookings.slot`, its PRIMARY index, with `BETWEEN 10 AND 20 FOR UPDATE`.
At REPEATABLE READ, insertion of 15 waits and reports `X,GAP,INSERT_INTENTION`.
At READ COMMITTED, the later insertion of 17 completes while A's locking read remains open.
These are the asserted observations, not a measurement of every interval locked.

<!--@include: ./parts/gap-locks.md-->

## What this means in practice

The [isolation manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_repeatable-read)
distinguishes an existing-row unique lookup from a range scan: the former needs only a
record lock; the latter can lock scanned index gaps and records. The index and execution
plan determine which intervals are scanned, potentially beyond the returned rows.
Do not infer identical lock coverage for another query or index from this transcript.

Gap locks can coexist. They inhibit inserts, so applications can still form a deadlock
when insert requests conflict with locks held by other transactions. This lesson does
not demonstrate that second schedule or rank gap locks as a cause of deadlocks.

At READ COMMITTED, gap locking for searches and index scans is disabled, with exceptions
for foreign-key and duplicate-key checking. Changing isolation changes read semantics too;
check the [READ COMMITTED lesson](/mysql/02-isolation/read-committed) against the business rule
before using it as a repair. Use [lock monitoring](/mysql/03-locking/monitoring-locks) to
identify the actual wait. Next: [lock queues](/mysql/03-locking/lock-queues).

## Further reading

- [MySQL docs: Locks Set by Different SQL Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
