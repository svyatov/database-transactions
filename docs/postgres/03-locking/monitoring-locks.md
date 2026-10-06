# Monitoring locks

PostgreSQL 18's [`pg_locks`](https://www.postgresql.org/docs/18/view-pg-locks.html) exposes held and requested lock-manager locks. [`pg_stat_activity`](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) supplies session state and wait events. Ordinary row locks are stored on disk and normally do not appear directly in `pg_locks`.

## What one UPDATE really holds

<!--@include: ./parts/monitoring-locks.md-->

The assertion checks four entries for this single-row UPDATE on this table and primary index: two `RowExclusiveLock` relation locks, its assigned transaction-id `ExclusiveLock`, and its virtual-transaction-id `ExclusiveLock`. This is not a universal lock count for an UPDATE. The table mode conflicts with some stronger table modes, not with another `RowExclusiveLock`.

B's row wait appears as an ungranted `ShareLock` on a transaction id. The [view contract](https://www.postgresql.org/docs/18/view-pg-locks.html) explains why: a request to wait for a transaction to end can wait on its xid lock. Every running transaction holds its virtual xid lock; an assigned permanent xid adds another lock. Tuple lock-manager entries can also appear, so absence of the ordinary on-disk row lock does not mean there can never be a `tuple` entry.

## Finding the blocker

The demonstrated monitoring query asserts B-to-A. Its pid/query variant below is illustrative, not another executed schedule:

```sql
SELECT waiter.pid AS waiting_pid,
       waiter.query AS waiting_query,
       blocker.pid AS blocking_pid,
       blocker.state AS blocker_state,
       blocker.query AS blocker_query
FROM pg_stat_activity waiter
JOIN pg_stat_activity blocker ON blocker.pid = ANY (pg_blocking_pids(waiter.pid))
WHERE waiter.wait_event_type = 'Lock';
```

`active` means executing a query; it does not prove slow progress. `idle in transaction` means waiting for a client command inside a transaction; it does not prove the client will never continue. Use transaction age and application context to decide what to do. Visibility of other sessions' details depends on monitoring privileges. These live views are not one fully atomic history of the server. [Chapter 8](/postgres/08-production/who-is-blocking-whom) provides operational follow-up.

## Further reading

- [PostgreSQL 18: pg_locks](https://www.postgresql.org/docs/18/view-pg-locks.html)
- [PostgreSQL 18: pg_stat_activity](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/03-locking/monitoring-locks)
