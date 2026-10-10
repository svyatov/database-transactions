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

## Index interval mechanism

<figure class="mechanism">
<div class="mechanism-view" tabindex="0" role="region" aria-label="Scrollable InnoDB index-gap mechanism">
<img src="/diagrams/mysql-index-gap.svg" alt="PRIMARY keys 10, 20, 30; insertion of 15 into the gap between 10 and 20 waits for A's range protection at REPEATABLE READ." />
</div>
<figcaption>Relevant-interval teaching model for the asserted MySQL 8.4.11 InnoDB schedule above. The shaded open interval contains no record at 15. The arrow is B's insert request, not a serialization dependency or a second transaction timeline. This view does not enumerate A's complete lock footprint.</figcaption>
</figure>

**Text equivalent:** `bookings.slot` is the PRIMARY index, with initial keys 10, 20, and 30. A's explicit REPEATABLE READ transaction scans `slot BETWEEN 10 AND 20 FOR UPDATE`. B's insertion at 15 falls in the open interval `(10, 20)` and waits for A. The Scenario asserts the pending insertion and its `X,GAP,INSERT_INTENTION` mode, then resolves it after A commits. It does not assert each held lock's boundary. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html#innodb-gap-locks) states: “A gap lock is a lock on a gap between index records”. The picture explains the relevant gap using that Documented contract and the known keys, rather than presenting a measured lock inventory.

After B commits 15, the later READ COMMITTED scan returns 10, 15, and 20. Insertion of 17, between 15 and 20, completes before A commits. This second observation has different initial keys and isolation; it is not an assertion that every READ COMMITTED insert avoids waiting. [Replay the source](/about/run-locally) with `bun lesson mysql/03-locking/gap-locks`; the generated Transcript and timeline above remain the execution evidence.

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
