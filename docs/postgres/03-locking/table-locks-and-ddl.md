# Table locks & DDL

PostgreSQL 18 [documents table-lock modes](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-TABLES) for operations on relations. Ordinary SELECT acquires ACCESS SHARE. DROP TABLE, TRUNCATE and many ALTER TABLE forms need ACCESS EXCLUSIVE, which conflicts with every table-lock mode from another transaction. [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html) specifies exceptions per form. DDL duration is not measured here.

## The outage, reproduced

A reads accounts inside a transaction and retains ACCESS SHARE. B's ADD COLUMN waits for ACCESS EXCLUSIVE. C's new SELECT then waits behind B's queued request, as the asserted B-to-A and C-to-B edges show:

<!--@include: ./parts/alter-table-outage.md-->

A's COMMIT lets the standalone ALTER complete, and then C's read completes. This schedule demonstrates a queued DDL request delaying a new read. It does not prove that every later query must wait: a transaction that already has the required lock is a different case.

::: warning Bound migration lock waits
Set a suitable session lock_timeout and handle failure. A timed-out DDL request can still delay later requests while it remains queued.
:::

## The fix: lock_timeout + retry

<!--@include: ./parts/ddl-lock-timeout.md-->

B first waits and gets `55P03`. C is dispatched only after that failure, so its successful read demonstrates recovery after the request leaves the queue, not zero disruption during the wait. After A commits, B retries and the asserted column exists. These are standalone DDL attempts; explicit-transaction error recovery needs rollback or a prior savepoint.

The [client-setting contract](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-LOCK-TIMEOUT) discourages global lock_timeout because it affects every session. It limits each acquisition, not total migration time. Retry success is not guaranteed under continuing contention.

As Documented contracts, SET STATISTICS uses SHARE UPDATE EXCLUSIVE, compatible with ordinary reads and writes but conflicting with some maintenance and DDL. [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) without CONCURRENTLY blocks writes but permits reads. CONCURRENTLY permits concurrent table writes but has extra phases, waits, and failure restrictions; it is not a no-wait promise. These variants are not executed in this chapter. Use the [monitoring lesson](/postgres/03-locking/monitoring-locks) to inspect the actual wait.

## Further reading

- [PostgreSQL 18: Table-Level Locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-TABLES)
- [PostgreSQL 18: ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)
- [The same lesson on MySQL](/mysql/03-locking/table-locks-and-ddl)
