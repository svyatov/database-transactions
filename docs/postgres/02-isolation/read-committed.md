# Read Committed

The [PostgreSQL 18 Read Committed manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)
documents the default level. A plain SELECT, without FOR UPDATE or FOR SHARE, uses
a snapshot of data committed before that query began, plus earlier changes from its
own transaction. It excludes other transactions' uncommitted changes and commits
that occur during that query. Updating and locking commands have additional rules.

## No dirty reads, even if you ask for them

B requests READ UNCOMMITTED and still reads 100 rather than A's uncommitted 999.
The [manual's level mapping](https://www.postgresql.org/docs/18/transaction-iso.html)
documents READ COMMITTED behavior for READ UNCOMMITTED; this one read illustrates it.

<!--@include: ./parts/no-dirty-reads.md-->

## Non-repeatable reads

A's two plain SELECTs return different values around B's committed UPDATE. The
second part also asserts that a competing UPDATE waits for a row lock.

<!--@include: ./parts/non-repeatable-read.md-->

## Phantoms

A's later aggregate includes B's newly committed matching row, changing its count
from two to three inside the same transaction.

<!--@include: ./parts/phantom-read.md-->

## Read skew: a total that never existed

Separate reads around a committed transfer yield 50 and 75, totaling 125 rather
than 100. The second schedule uses REPEATABLE READ and its two reads total 100.
This concerns separate queries, not a single plain SELECT over both accounts.

<!--@include: ./parts/read-skew.md-->

## The subtle one: UPDATE re-checks its WHERE clause

The [Read Committed updating-command contract](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)
documents that an updater can wait, then operate on a newly committed target version
after rechecking its predicate. It can therefore use a target version outside its
initial snapshot. A single updating command is not necessarily a consistent snapshot
of all rows it consults.

<!--@include: ./parts/update-recheck.md-->

Here B affects zero rows because value = 10 no longer matches after A commits 20.
Check affected-row counts when application success depends on a row being changed.
Plain SELECTs do not wait for these row-update locks, but they can wait for conflicting
table locks, as the [table-lock manual](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-TABLES)
documents. The snapshot contract concerns transactional table rows; sequences have
[separate visibility and rollback rules](https://www.postgresql.org/docs/18/transaction-iso.html).

## Further reading

- [Lost updates](/postgres/02-isolation/lost-update)
- [The same lesson on MySQL](/mysql/02-isolation/read-committed)
