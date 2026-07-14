# Row locks

MVCC means readers and writers never block each other. So who *does* block? Writers competing
for the same rows. Every UPDATE and DELETE takes a row lock, and you can take one explicitly
with `SELECT ... FOR UPDATE` and friends. This page shows what those locks do, which ones
coexist, and the row locks you're taking without knowing it.

## FOR UPDATE blocks writers, and only writers

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

You rarely type the middle two by hand, yet PostgreSQL reaches for them constantly
([Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)).
An UPDATE that doesn't touch key columns takes `FOR NO KEY UPDATE`. The manual: "This lock mode
is also acquired by any UPDATE that does not acquire a FOR UPDATE lock." An UPDATE that changes a
key, and every DELETE, takes the full `FOR UPDATE`. A foreign-key check takes the weakest mode,
`FOR KEY SHARE`, on the referenced row; the manual never quite says so, but the scenario below
proves it: the conflict signature you'll see, a non-key UPDATE passing while a DELETE blocks,
matches `FOR KEY SHARE` and nothing else in the matrix.

<!--@include: ./parts/lock-mode-matrix.md-->

## The row locks you didn't know you were taking

Insert a child row, and PostgreSQL locks the parent row for you, with `FOR KEY SHARE`, so the
parent can still be updated, but not deleted or re-keyed. That's not a courtesy: without the
lock, the parent could vanish between the FK check and the commit.

<!--@include: ./parts/fk-key-share.md-->

Once you know the implicit locks, most "why is this blocked?" mysteries explain themselves. A
plain `SELECT` takes no row locks, ever. Row locks are a writers-only affair. `UPDATE` takes
`FOR NO KEY UPDATE`, `DELETE` (or a key-changing `UPDATE`) takes `FOR UPDATE`, and an FK insert
takes `FOR KEY SHARE` on the parent. Two share-mode locks coexist, which is what keeps hot
parent rows survivable under foreign-key churn.

Two properties of row locks carry over into the next chapters. They live until the transaction
ends: there's no unlock statement, so a long transaction means long-held locks. And they're
written into the row on disk: `SELECT FOR UPDATE` causes writes, which is why there's
[no limit on how many rows you can lock](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
and why they're invisible in `pg_locks`. The [monitoring lesson](/postgres/03-locking/monitoring-locks)
shows what you see instead, and the MVCC chapter shows the `xmax` stamp that does the work.

## Further reading

- [PostgreSQL docs: Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL docs: SELECT: The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [The same lesson on MySQL](/mysql/03-locking/row-locks)
