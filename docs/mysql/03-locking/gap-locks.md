# Gap locks: locking rows that don't exist

PostgreSQL locks rows. InnoDB at REPEATABLE READ also locks the *spaces between* rows —
**gap locks** — and the combination of a row lock plus the gap before it, a **next-key
lock**. It's how InnoDB keeps phantoms out of locking reads without PostgreSQL-style
predicate tracking: if nobody can insert into the range you scanned, nobody can create a
phantom in it.

The price: INSERTs into a scanned range wait for transactions that never touched any
existing row they conflict with.

## An INSERT blocked by a SELECT

<!--@include: ./parts/gap-locks.md-->

## What this means in practice

- **Locking reads on ranges are range reservations** at REPEATABLE READ. `WHERE slot
  BETWEEN 10 AND 20 FOR UPDATE` locks the rows it finds *and* every gap in between — plus
  the gap up to the next key above the range.
- **Gap locks are a top deadlock source.** Two transactions can each gap-lock the same range
  (gap locks don't conflict with each other — only with inserts), then both try to INSERT
  into it: each waits for the other's gap lock, deadlock,
  [errno `1213`](/mysql/03-locking/deadlocks).
- **READ COMMITTED switches most of this off** — gap locking is then used only for
  foreign-key and duplicate-key checks
  ([the manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)).
  That's the usual first fix when gap-lock waits or deadlocks dominate — at the price of
  [everything READ COMMITTED allows](/mysql/02-isolation/read-committed).
- The waiting lock is visible in `performance_schema.data_locks` as
  `X,GAP,INSERT_INTENTION` — an *insert intention* lock, the marker to look for when an
  INSERT is mysteriously stuck ([monitoring locks](/mysql/03-locking/monitoring-locks)).

## Key takeaways

- At REPEATABLE READ, locking reads take next-key locks: rows **and** gaps. INSERTs into a
  locked gap wait.
- Gap locks exist to prevent phantoms in locking reads — they're the reason InnoDB's RR is
  stronger than the standard requires, and the reason it deadlocks more.
- Inserts blocked with no visible row conflict? Look for `GAP` / `INSERT_INTENTION` in
  `performance_schema.data_locks`.

## Further reading

- [MySQL docs: InnoDB Locking — gap locks, next-key locks, insert intention locks](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
