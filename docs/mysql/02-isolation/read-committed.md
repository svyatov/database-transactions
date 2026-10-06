# Read Committed

The [MySQL 8.4 READ COMMITTED contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)
gives each **consistent nonlocking SELECT** a fresh snapshot of committed data,
plus the transaction's own earlier changes. This is not the rule for every
statement: UPDATE and locking reads can wait and use current rows. The following
schedules run on MySQL 8.4.11, InnoDB, with explicitly selected levels.

## Non-repeatable reads

A reads 100, B commits 200, and A's next SELECT reads 200. The second part asserts
a competing UPDATE's row-lock wait and eventual committed value 400. The plain
SELECTs here do not wait for row writers; that does not exclude metadata-lock waits.

<!--@include: ./parts/non-repeatable-read.md-->

## Phantoms

B's committed INSERT changes A's matching set from two rows to three, total 1500.
The count and total are returned SQL values, not a published application report.

<!--@include: ./parts/phantom-read.md-->

## Read skew: a total that never existed

A reads alice before B's transfer and bob after it: the returned values add to
125 although each committed state totals 100. The repeated REPEATABLE READ
schedule returns 25 and 75, using one snapshot with no writes by the reader.

<!--@include: ./parts/read-skew.md-->

## After the wait, the re-check

The manual's READ COMMITTED section documents semi-consistent UPDATE reads:
a committed version can be used to check whether a locked row matches, followed
by a current re-read and lock if it qualifies. Here B waits for A, then skips the
row after A commits value 20. Zero affected rows and final values 20/30 are asserted.

<!--@include: ./parts/update-recheck.md-->

Check affected rows instead of assuming a prior SELECT fixed the UPDATE's targets.
For reports made from several nonlocking SELECTs, a REPEATABLE READ snapshot can
exclude intervening concurrent commits, provided the reader does not itself change
the data or mix current reads into that report. The manual also documents that
READ COMMITTED disables gap locking for searches/index scans except foreign-key
and duplicate-key checks. These schedules do not measure throughput or lock cost.

## Further reading

- [MySQL 8.4: Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
- [The same lesson on PostgreSQL](/postgres/02-isolation/read-committed)
