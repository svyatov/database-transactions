# Monitoring locks

Everything this chapter demonstrated, you can watch live in two views: `pg_locks` (every lock
held or wanted, right now) and `pg_stat_activity` (what every backend is doing). This lesson is
the guided tour; the production runbook chapter builds alerting on top of it.

## What one UPDATE really holds

<!--@include: ./parts/monitoring-locks.md-->

Four rows for one little UPDATE, and each earns its place. The two `relation` /
`RowExclusiveLock` entries (one on the table, one on its index) are the "I am writing to this
table" locks; they conflict with DDL, not with other writers. The `transactionid` /
`ExclusiveLock` is the hook the whole row-wait mechanism hangs on: every transaction holds an
exclusive lock on its own transaction id, and waiting for a row really means
[requesting a share lock on the xid that wrote it](https://www.postgresql.org/docs/current/view-pg-locks.html),
which succeeds "only when the other transaction terminates". The `virtualxid` entry is the same
idea for transactions that haven't written anything yet.

Notice what's *missing*: the locked row itself. Row locks live in the row header on disk (you'll
watch `xmax` do this job in the MVCC chapter), not in `pg_locks`, otherwise memory would cap
how many rows you could lock.

## Finding the blocker

The one query worth memorizing (or bookmarking) is the wait chain:

```sql
SELECT waiter.pid  AS waiting_pid,
       waiter.query AS waiting_query,
       blocker.pid  AS blocking_pid,
       blocker.state AS blocker_state,
       blocker.query AS blocker_query
FROM pg_stat_activity waiter
JOIN pg_stat_activity blocker ON blocker.pid = ANY (pg_blocking_pids(waiter.pid))
WHERE waiter.wait_event_type = 'Lock';
```

`blocker_state` is the column that solves incidents. A blocker that's `active` is slow; a
blocker that's `idle in transaction` is stuck: an app that did `BEGIN`, made changes, and
wandered off to do something else. That second kind never resolves on its own.

It helps to see that the two views are describing one fact from two angles: a waiter is a
`pg_locks` row with `granted = f`, and the same waiter is a `pg_stat_activity` row with
`wait_event_type = 'Lock'`. You could join `pg_locks` to itself by hand to find the culprit, but
`pg_blocking_pids(pid)` already understands lock queues, including blockers that are merely
ahead in line, so it saves you the archaeology. Pair it with `blocker_state` and you've answered
the only question that matters mid-incident: is the blocker slow, or is it stuck?
[Chapter 8 turns this into a runbook](/postgres/08-production/who-is-blocking-whom), down to what
to do once you've found the culprit.

## Further reading

- [PostgreSQL docs: The `pg_locks` view](https://www.postgresql.org/docs/current/view-pg-locks.html)
- [PostgreSQL docs: `pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/03-locking/monitoring-locks)
