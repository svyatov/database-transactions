# Fixing lost updates

Three READ COMMITTED schedules repair the single-row
[lost update](/postgres/02-isolation/lost-update): relative SQL arithmetic,
a locking read, and a checked version column. Each asserts a final balance
of 120 from two deposits of 10. These are Demonstrated behaviors under the
shown writer protocols, not protection for every business rule.

## Fix #1: compute in SQL, not in the app

<!--@include: ./parts/fix-lost-update-atomic.md-->

B's relative UPDATE waits, then applies its increment to A's committed 110.
The PostgreSQL 18 [READ COMMITTED contract](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)
explains the updated-row recheck. No stale application value is written
back in this operation. Other predicates, constraints and cross-row rules
require their own analysis. At stronger isolation levels a conflicting
update can instead raise `40001`.

## Fix #2: `SELECT ... FOR UPDATE` (pessimistic)

<!--@include: ./parts/fix-lost-update-for-update.md-->

B's locking read waits and returns 110 after A commits. Ordinary SELECT
has different visibility and does not take this row lock. The
[row-lock contract](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
protects selected rows against conflicting changes until transaction end.
Every participating read-modify-write writer must lock before reading and
write within that same transaction. Keep it short; do not hold it open
while a user thinks or a slow external call runs.

## Fix #3: a version column (optimistic)

<!--@include: ./parts/fix-lost-update-version-column.md-->

B's stale predicate matches zero rows. In this additive-deposit example,
B rolls back, rereads 110/version 2, and successfully writes 120/version 3.
Every writer must check and advance the version. UPDATE 0 can also mean a
deleted row; it is not a complete diagnosis. For a stale user edit, report
the conflict or reconsider the edit instead of automatically replacing
newer work. The UPDATE still takes a row lock and can wait; optimistic
locking avoids a long-held lock during the earlier read-to-edit interval.

Prefer relative SQL for this increment, a locking read for a short
transaction that computes a new value, or a checked version for a long
read-to-write interval. These are recommendations for the stated shapes,
not a universal selector. Handle errors and zero-row outcomes. None of
these repairs alone enforces a cross-row invariant or protects external
effects. [Whole-transaction retry](/postgres/05-patterns/retrying-serialization-failures)
is needed when stronger isolation rejects the transaction.

## Further reading

- [PostgreSQL 18: Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [PostgreSQL 18: Row-Level Locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
- [The same lesson on MySQL](/mysql/05-patterns/fixing-lost-updates)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-patterns) records the exact manual support and execution limits for this lesson.
