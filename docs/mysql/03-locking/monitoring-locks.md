# Monitoring locks

MySQL 8.4 exposes InnoDB data locks and metadata locks through different Performance Schema
tables. Monitoring requires sufficient privileges and, for metadata events, enabled instrumentation.

## What one UPDATE really holds, and spotting the waiter

This existing-row PRIMARY-key UPDATE holds a table IX lock and an `X,REC_NOT_GAP` record
lock. The transcript asserts these rows, B's WAITING request, and its blocker.
It does not establish a two-lock count for every UPDATE: other access paths can lock more
index records, gaps, and clustered records.

<!--@include: ./parts/monitoring-locks.md-->

## The production cheat sheet

These are documented diagnostic interfaces; the transcript exercises the first two.

```sql
-- InnoDB waiters and blockers, with available query information:
SELECT * FROM sys.innodb_lock_waits;

-- Data locks held or requested, not metadata locks:
SELECT * FROM performance_schema.data_locks;

-- Metadata locks, including pending requests (requires instrumentation):
SELECT * FROM performance_schema.metadata_locks;

-- Sessions reporting a metadata-lock wait:
SELECT * FROM performance_schema.processlist
WHERE state = 'Waiting for table metadata lock';
```

The [data_locks contract](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-data-locks-table.html)
and [sys view contract](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
describe data-lock requests and their blockers. MDL has its own
[metadata_locks table](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-metadata-locks-table.html);
processlist is not its only diagnostic interface.

::: warning Monitoring is not an atomic picture
The [transaction-information consistency manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-information-schema-internal-data.html)
provides transaction and wait diagnostics. Different queries can observe different moments.
Do not infer a permanently unchanged transaction from a repeated monitoring result.
:::

If an operator chooses cancellation, the [KILL manual](https://dev.mysql.com/doc/refman/8.4/en/kill.html)
distinguishes `KILL QUERY <processlist_id>` (current statement) from `KILL <processlist_id>`
(connection). Canceling a statement does not by itself end an open transaction or release
all of its earlier locks. These operations are not executed by this lesson's scenario.
Next: [MVCC and the undo log](/mysql/04-mvcc/undo-logs).

## Further reading

- [The PostgreSQL counterpart](/postgres/03-locking/monitoring-locks)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
