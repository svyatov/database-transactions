# Lost updates

The most common real-world transaction bug: two clients read a value, compute a new one in
application code, and write it back. One update silently erases the other. No error is
raised — the data is simply wrong.

## At READ COMMITTED

<<< ../../../scenarios/mysql/02-isolation/lost-update-read-committed.ts#demo{ts}

<!--@include: ./parts/lost-update-read-committed.md-->

## REPEATABLE READ does *not* save you

This is the sharpest MySQL/PostgreSQL divergence in the whole chapter. PostgreSQL's
REPEATABLE READ [detects the stale write and aborts it](/postgres/02-isolation/lost-update)
with `40001`. MySQL's UPDATE is a [current read](/mysql/02-isolation/repeatable-read) — it
applies your stale arithmetic to the newest row version and raises nothing:

<<< ../../../scenarios/mysql/02-isolation/lost-update-repeatable-read.ts#demo{ts}

<!--@include: ./parts/lost-update-repeatable-read.md-->

## The fixes

Raising the isolation level is not one of them (short of SERIALIZABLE). On MySQL you fix
lost updates *structurally*:

1. **Atomic UPDATE** — do the math in SQL, not in the app:
   `UPDATE accounts SET balance = balance + 10 WHERE id = 1`. The row lock serializes the
   two increments.
2. **Pessimistic lock** — read with `SELECT … FOR UPDATE`; the second reader waits until the
   first commits, then sees the fresh value ([chapter 3](/mysql/03-locking/row-locks)).
3. **Optimistic version column** —
   `UPDATE … SET balance = ?, version = version + 1 WHERE id = ? AND version = ?`; if
   `affectedRows` is 0, someone got there first: reread and retry.

## Key takeaways

- A lost update is silent: the transcript above ends with `110` where two +10 deposits on
  `100` should give `120` — and nothing errored.
- **No isolation level below SERIALIZABLE prevents it on MySQL.** If your app reads, computes,
  and writes back, it has this bug until you apply one of the three fixes.
- Porting note: code relying on PostgreSQL's RR conflict detection loses that protection
  silently on MySQL.

## Further reading

- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
