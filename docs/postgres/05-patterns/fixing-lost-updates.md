# Fixing lost updates

[Chapter 2's scariest bug](/postgres/02-isolation/lost-update): two read-modify-write transactions,
one deposit silently gone. This lesson is the toolbox — three fixes, in the order you
should reach for them. All three run at plain READ COMMITTED; none of them needs a higher
isolation level.

## Fix #1: compute in SQL, not in the app

If the new value can be expressed in SQL, the whole bug class evaporates — there is no
stale read to write back:

<!--@include: ./parts/fix-lost-update-atomic.md-->

B's UPDATE waits for A's row lock, then — this is the
[update-recheck behavior](/postgres/02-isolation/read-committed) from chapter 2, now working *for*
you — re-reads the committed 110 and applies `+ 10` on top of it. The recheck that made
read-modify-write dangerous makes single-statement math safe.

## Fix #2: `SELECT ... FOR UPDATE` (pessimistic)

Sometimes the new value genuinely needs application code — business rules, an external
rate lookup. Then lock the row *at the read*, so the read-modify-write becomes a queue:

<!--@include: ./parts/fix-lost-update-for-update.md-->

The manual's definition is exactly the guarantee we need:
["FOR UPDATE causes the rows retrieved by the SELECT statement to be locked as though for update. This prevents them from being locked, modified or deleted by other transactions until the current transaction ends."](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
B cannot even *read* (with intent to write) until A is done — and its read then returns
110, not the stale 100. The price: B waits, and waiting transactions are
[lock queues](/postgres/03-locking/lock-queues) with everything chapter 3 said about them.

## Fix #3: a version column (optimistic)

Pessimistic locking holds a lock while the app thinks. If "thinking" includes a user
staring at an edit form, that's unacceptable — you can't hold a row lock across HTTP
requests. Optimistic locking holds nothing and instead *detects* the conflict at write
time:

<!--@include: ./parts/fix-lost-update-version-column.md-->

`UPDATE 0` is the entire mechanism: the write names the version it read, and if the row
has moved on, it matches nothing. The lost update didn't become impossible — it became
**detectable**, and the retry (re-read, recompute, write against the new version) lands
safely. Every ORM's "optimistic concurrency" feature is this one WHERE clause.

## Key takeaways

- **Prefer fix #1**: `SET balance = balance + 10` is race-free at any isolation level and
  never waits longer than the lock itself. Use it whenever SQL can express the change.
- **Fix #2 (`FOR UPDATE`)** when application code must compute the value inside one
  short transaction. It trades throughput (waiting) for simplicity.
- **Fix #3 (version column)** when the read and the write are separated by something you
  can't hold a lock across — user think-time, an HTTP round-trip, a slow external call.
  Be ready to handle `UPDATE 0` everywhere you write.
- The fourth fix is [REPEATABLE READ + retry](/postgres/05-patterns/retrying-serialization-failures):
  let PostgreSQL detect the conflict as a `40001` and rerun the transaction.

## Further reading

- [PostgreSQL docs: Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL docs: The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
