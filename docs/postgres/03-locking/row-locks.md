# Row locks

Ordinary MVCC SELECTs do not conflict with row locks. Locking SELECTs, UPDATEs and DELETEs can conflict on the same row. Table locks, functions called by a query, and other resources can still cause a read to wait. This chapter uses PostgreSQL 18; the linked transcripts state the executed patch version.

## FOR UPDATE blocks writers, and only writers

The legacy heading names the example, not a universal rule: FOR UPDATE also conflicts with other sessions' locking reads. Here B's ordinary SELECT returns 100 while A holds FOR UPDATE; B's UPDATE waits, then uses A's committed 150 and leaves 140.

<!--@include: ./parts/for-update-blocks.md-->

## The four modes

This complete compatibility table is a [Documented contract, Table 13.3](https://www.postgresql.org/docs/18/explicit-locking.html#ROW-LOCK-COMPATIBILITY), not sixteen executed combinations. ✅ means compatible between different transactions; ⛔ means conflicting requests on the same row.

| you hold ↓ / they want → | FOR KEY SHARE | FOR SHARE | FOR NO KEY UPDATE | FOR UPDATE |
|---|---|---|---|---|
| **FOR KEY SHARE** | ✅ | ✅ | ✅ | ⛔ |
| **FOR SHARE** | ✅ | ✅ | ⛔ | ⛔ |
| **FOR NO KEY UPDATE** | ✅ | ⛔ | ⛔ | ⛔ |
| **FOR UPDATE** | ⛔ | ⛔ | ⛔ | ⛔ |

The [row-lock contract](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) specifies FOR UPDATE for DELETE and UPDATEs of certain key columns: currently columns with a unique index usable for a foreign key, excluding partial and expression indexes. Other UPDATEs take FOR NO KEY UPDATE. Do not treat every indexed-column update as key-changing for this rule.

<!--@include: ./parts/lock-mode-matrix.md-->

This schedule executes SHARE/SHARE coexistence, SHARE blocking a non-key UPDATE, KEY SHARE coexisting with that UPDATE, and FOR UPDATE waiting for it. It does not execute the entire table.

## The row locks you didn't know you were taking

<!--@include: ./parts/fk-key-share.md-->

The immediate foreign-key insert in this setup allows B's non-key update while its parent DELETE waits and later fails with `23503`. That conflict signature is consistent with KEY SHARE; the scenario does not directly decode the lock mode. PostgreSQL 18's [foreign-key implementation](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/utils/adt/ri_triggers.c) uses a FOR KEY SHARE lookup for this check. Deferred checks and other actions are not executed here.

Row locks normally remain until transaction end, but [rollback to a savepoint releases locks acquired since it](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS). Row locking can write tuple headers to disk. Ordinary row locks normally do not appear in `pg_locks`; the [monitoring lesson](/postgres/03-locking/monitoring-locks) shows the wait representation. SELECT without a locking clause does not by itself acquire these row-lock modes, but called functions can take locks.

## Further reading

- [PostgreSQL 18: Row-Level Locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL 18: SELECT locking clause](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [The same lesson on MySQL](/mysql/03-locking/row-locks)
