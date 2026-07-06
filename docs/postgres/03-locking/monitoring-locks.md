# Monitoring locks

Everything this chapter demonstrated, you can watch live in two views: `pg_locks` (every lock
held or wanted, right now) and `pg_stat_activity` (what every backend is doing). This lesson
is the guided tour; the production runbook chapter will build alerting on top of it.

## What one UPDATE really holds

::: code-group
<<< ../../../scenarios/postgres/03-locking/monitoring-locks.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/postgres/03-locking/monitoring-locks.py#demo{py} [Python]
:::

<!--@include: ./parts/monitoring-locks.md-->

Reading those four rows:

- **`relation` / `RowExclusiveLock`** on the table and its index — the "I am writing to this
  table" locks. They conflict with DDL, not with other writers.
- **`transactionid` / `ExclusiveLock`** — every transaction holds an exclusive lock on its own
  transaction id. This is the hook the whole row-wait mechanism hangs on: waiting for a row
  really means
  [requesting a share lock on the xid that wrote it](https://www.postgresql.org/docs/current/view-pg-locks.html),
  which is granted "only when the other transaction terminates".
- **`virtualxid`** — same idea for transactions that haven't written anything yet.

Notice what's *missing*: the locked **row** itself. Row locks live in the row header on disk
(you'll see `xmax` do this job in the MVCC chapter), not in `pg_locks` — or memory would cap
how many rows you could lock.

## Finding the blocker

::: code-group
<<< ../../../scenarios/postgres/03-locking/monitoring-locks.ts#waiter{ts} [TypeScript]
<<< ../../../python/scenarios/postgres/03-locking/monitoring-locks.py#waiter{py} [Python]
:::

The one query worth memorizing — or bookmarking — is the **wait chain**:

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

`blocker_state` is the column that solves incidents: a blocker that's `active` is slow; a
blocker that's **`idle in transaction`** is *stuck* — an app that did `BEGIN`, made changes,
and went off to do something else. That second kind never resolves on its own.

## Key takeaways

- A waiter = `pg_locks` row with `granted = f` = `pg_stat_activity` row with
  `wait_event_type = 'Lock'`. Same fact, two views.
- `pg_blocking_pids(pid)` beats manual `pg_locks` joins: it already understands lock queues,
  including blockers that are merely *ahead in line*.
- Row locks are invisible in `pg_locks` — you'll see the waiter camped on the blocker's
  `transactionid` instead.
- The wait-chain query + `blocker_state` answers the incident question: slow, or stuck?
  [Chapter 8 turns it into a runbook](/postgres/08-production/who-is-blocking-whom), including
  what to do once you've found the culprit.

## Further reading

- [PostgreSQL docs: The `pg_locks` view](https://www.postgresql.org/docs/current/view-pg-locks.html)
- [PostgreSQL docs: `pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
