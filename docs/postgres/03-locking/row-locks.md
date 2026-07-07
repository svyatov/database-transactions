# Row locks

MVCC means readers and writers never block each other — so who *does* block? Writers
competing for the **same rows**. Every UPDATE and DELETE takes a row lock; you can take them
explicitly with `SELECT ... FOR UPDATE` and friends. This page shows what those locks do,
which ones coexist, and the row locks you're taking without knowing it.

## FOR UPDATE blocks writers — and only writers

<!--@include: ./parts/for-update-blocks.md-->

## The four modes

Row locks come in four strengths
([the manual's Table 13.3](https://www.postgresql.org/docs/current/explicit-locking.html#ROW-LOCK-COMPATIBILITY)
is the same conflict matrix):

| you hold ↓ / they want → | FOR KEY SHARE | FOR SHARE | FOR NO KEY UPDATE | FOR UPDATE |
|---|---|---|---|---|
| **FOR KEY SHARE** | ✅ | ✅ | ✅ | ⛔ |
| **FOR SHARE** | ✅ | ✅ | ⛔ | ⛔ |
| **FOR NO KEY UPDATE** | ✅ | ⛔ | ⛔ | ⛔ |
| **FOR UPDATE** | ⛔ | ⛔ | ⛔ | ⛔ |

You rarely type the middle two — but PostgreSQL uses them constantly
([Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)):

- an **UPDATE that doesn't touch key columns** takes `FOR NO KEY UPDATE` ("this lock mode is
  also acquired by any UPDATE that does not acquire a FOR UPDATE lock");
- an **UPDATE that changes a key, and every DELETE**, takes `FOR UPDATE`;
- a **foreign-key check** takes `FOR KEY SHARE` on the referenced row. The manual never quite
  says so — but the scenario below proves it: the conflict signature you'll see (non-key
  UPDATE passes, DELETE blocks) matches `FOR KEY SHARE` and nothing else in the matrix.

<!--@include: ./parts/lock-mode-matrix.md-->

## The row locks you didn't know you were taking

Insert a child row, and PostgreSQL locks the parent row for you — with `FOR KEY SHARE`, the
weakest mode, so the parent can still be updated, just not deleted or re-keyed. That's not a
courtesy: without the lock, the parent could vanish between the FK check and the commit.

<!--@include: ./parts/fk-key-share.md-->

## Key takeaways

- Plain `SELECT` takes **no row locks, ever**. Row locks are a writers-only affair.
- `UPDATE` = `FOR NO KEY UPDATE`, `DELETE` (or key-changing `UPDATE`) = `FOR UPDATE`,
  FK insert = `FOR KEY SHARE` on the parent. Know the implicit locks and the matrix above
  explains most "why is this blocked?" mysteries.
- Two share-mode locks coexist; that's what makes hot parent rows under FK churn survivable.
- Row locks live until the transaction ends — there is no unlock statement. Long transaction =
  long locks.
- Row locks are written **into the row on disk** (`SELECT FOR UPDATE` causes writes!), which
  is why there's
  [no limit on how many rows you can lock](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS) —
  and why they're invisible in `pg_locks` ([monitoring lesson](/postgres/03-locking/monitoring-locks)).

## Further reading

- [PostgreSQL docs: Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL docs: SELECT — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
