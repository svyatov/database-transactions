# Gap locks: locking rows that don't exist

PostgreSQL locks rows. InnoDB at REPEATABLE READ also locks the spaces between rows
(*gap locks*) and the combination of a row lock plus the gap before it, a *next-key
lock*. It's how InnoDB keeps phantoms out of locking reads without PostgreSQL-style
predicate tracking: if nobody can insert into the range you scanned, nobody can create a
phantom in it.

The price: INSERTs into a scanned range wait for transactions that never touched any
existing row they conflict with.

## An INSERT blocked by a SELECT

<!--@include: ./parts/gap-locks.md-->

## What this means in practice

At REPEATABLE READ a locking read on a range is a reservation on the whole range, not only the
rows it returns. `WHERE slot BETWEEN 10 AND 20 FOR UPDATE` locks the rows it finds and every
gap between them, plus the gap running up to the next key above the range, so nothing new can
appear in that window until you commit.

That permissiveness among readers is exactly why gap locks are a top deadlock source. Gap locks
don't conflict with each other, only with inserts, so two transactions can gap-lock the same
range at the same time, and then both try to INSERT into it. Each now waits for the other's gap
lock, and that's a deadlock, [errno `1213`](/mysql/03-locking/deadlocks).

READ COMMITTED switches most of this off: gap locking there is used only for foreign-key and
duplicate-key checks
([the manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)).
That's the usual first fix when gap-lock waits or deadlocks dominate, paid for with
[everything READ COMMITTED allows](/mysql/02-isolation/read-committed). When an INSERT is stuck
with no visible row conflict, the tell is in `performance_schema.data_locks`: a waiting lock
tagged `X,GAP,INSERT_INTENTION`, the insert-intention lock
([monitoring locks](/mysql/03-locking/monitoring-locks)).

Gap locking is why InnoDB's REPEATABLE READ is stronger than the SQL standard asks for, and why
it deadlocks more than PostgreSQL: those two facts are the same fact. When the waits pile up
instead of deadlocking, the next thing to understand is how the
[queue itself behaves](/mysql/03-locking/lock-queues).

## Further reading

- [MySQL docs: InnoDB Locking (gap locks, next-key locks, insert intention locks)](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
