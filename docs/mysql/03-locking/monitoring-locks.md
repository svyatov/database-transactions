# Monitoring locks

When production "hangs", the question is always the same: *who holds what, and who is waiting
for whom?* MySQL answers both from `performance_schema`.

## What one UPDATE really holds, and spotting the waiter

<!--@include: ./parts/monitoring-locks.md-->

## The production cheat sheet

```sql
-- Who is blocked by whom, with the queries involved:
SELECT * FROM sys.innodb_lock_waits;

-- Every InnoDB row lock held or requested right now:
SELECT * FROM performance_schema.data_locks;

-- Sessions stuck on DDL (metadata locks, not row locks):
SELECT * FROM performance_schema.processlist
WHERE state = 'Waiting for table metadata lock';

-- Kill the blocker's statement / whole connection:
KILL QUERY <processlist_id>;   KILL <processlist_id>;
```

::: warning Don't poll information_schema.innodb_trx
`information_schema.innodb_trx` (and the older lock views) are served from a cache that
refreshes only after it has been idle for 100 ms. A monitoring loop that queries it faster
than that keeps reading one stale snapshot and never sees it change.
`performance_schema.data_locks` reads live engine state. (This site's own test harness learned
that the hard way.)
:::

Two tables answer the question: `performance_schema.data_locks` lists every lock, `GRANTED` and
`WAITING`, while `sys.innodb_lock_waits` pre-joins the waiter→blocker graph with the offending
queries and thread ids. An ordinary UPDATE, seen through them, holds an intention-exclusive (IX)
lock on the table plus one X record lock per row it changed, and the intention lock is how row
and [table locks](/mysql/03-locking/table-locks-and-ddl) coexist without checking each other row
by row. One blind spot: MDL waits never show up in `data_locks`, so a stuck migration is visible
only in `processlist` as `Waiting for table metadata lock`. PostgreSQL asks the same questions
of `pg_locks` and `pg_blocking_pids()` ([compare](/postgres/03-locking/monitoring-locks)); with
the locking picture complete, the next chapter turns to the machinery that lets readers avoid
all of it: [MVCC and the undo log](/mysql/04-mvcc/undo-logs).

## Further reading

- [MySQL docs: The data_locks Table](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-data-locks-table.html)
- [MySQL docs: The innodb_lock_waits View](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The same lesson on PostgreSQL](/postgres/03-locking/monitoring-locks)
