# Read Committed

At READ COMMITTED, every statement gets a fresh snapshot: it sees everything committed by
the time *it* starts. Within one transaction, two identical reads can disagree, because the
world moved between them.

## Non-repeatable reads

<!--@include: ./parts/non-repeatable-read.md-->

## Phantoms

The same effect on a *set* of rows: a `WHERE` clause can match rows in the second reading
that didn't exist in the first.

<!--@include: ./parts/phantom-read.md-->

## Read skew: a total that never existed

Non-repeatable reads have a nastier multi-row cousin,
[read skew](/concepts/non-repeatable-read#read-skew): every row you read was committed and
correct, yet the combination existed at no point in time:

<!--@include: ./parts/read-skew.md-->

## After the wait, the re-check

When an UPDATE waits for a row lock and finally gets it, the row may no longer match its
`WHERE` clause. READ COMMITTED re-evaluates and silently skips it
([semi-consistent read](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)):

<!--@include: ./parts/update-recheck.md-->

A fresh snapshot per statement means no dirty reads, but non-repeatable reads and phantoms are
routine. If a report has to be internally consistent, run it at
[REPEATABLE READ](/mysql/02-isolation/repeatable-read). And `Query OK, 0 rows affected` after a
lock wait may mean the row escaped your `WHERE`, so code that assumes it updated exactly the
rows it saw is wrong at this level. InnoDB also takes fewer gap locks here than at RR, which is
one reason some heavy-write shops prefer it; locking is [chapter 3](/mysql/03-locking/row-locks).

## Further reading

- [MySQL docs: READ COMMITTED](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)
- [The same lesson on PostgreSQL](/postgres/02-isolation/read-committed)
