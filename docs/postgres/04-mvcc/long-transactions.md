# Long transactions block VACUUM

Everything in this chapter converges here. Old row versions must be kept as long as
**any snapshot might still read them** — so one forgotten transaction, holding one old
snapshot, pins garbage collection for the *whole database*. Not just the tables it read:
every table, because PostgreSQL only knows "this backend's snapshot needs xids from here
back", not which rows it will touch.

## VACUUM ran, cleaned nothing

<!--@include: ./parts/long-transactions.md-->

The first VACUUM is the quiet failure mode: **it succeeds**. No error, no warning in your
terminal — and the heap page is byte-for-byte unchanged, because the manual's rule is that
["the row version must not be deleted while it is still potentially visible to other transactions"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
— and A's Repeatable Read snapshot, taken before all three updates, can still see every
one of them (the scenario proves it: A still reads `'new'`). The instant A commits, the
identical command clears the page.

Autovacuum hits the same wall. A dashboard that shows autovacuum running on schedule can
sit right next to a table that's ballooning — the vacuums are running and *keeping
nothing*, while every UPDATE adds another [dead tuple](/postgres/04-mvcc/dead-tuples-and-bloat)
behind the pinned horizon.

## Spotting the offender

The horizon is visible in `pg_stat_activity.backend_xmin` — the oldest xid each backend's
snapshot still needs. The classic triage query (illustrative here; the production chapter
turns it into monitoring):

```sql
SELECT pid, state, application_name,
       age(backend_xmin) AS snapshot_age_xids,
       now() - xact_start AS tx_duration
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC;
```

The usual suspects: an app that did `BEGIN` and went idle
(`state = 'idle in transaction'` — the same villain as in the
[DDL outage](/postgres/03-locking/table-locks-and-ddl)), a many-hour analytics query against the
primary, a stuck migration. Guardrails exist for each:

- [`idle_in_transaction_session_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT) —
  kills sessions that hold a transaction open while doing nothing;
- [`transaction_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT)
  (PostgreSQL 17+) — a hard ceiling on total transaction duration;
- [`statement_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT) —
  bounds any single query.

## Key takeaways

- **A long transaction is a database-wide tax**, even if it's read-only and touches one
  tiny table. Snapshots are what's expensive — not the query, the *time you hold one*.
- VACUUM (and autovacuum) silently degrade to no-ops behind an old snapshot; the failure
  is invisible until the bloat is.
- Keep transactions short by design; set `idle_in_transaction_session_timeout` as a
  seatbelt. Chapter 8 builds the
  [alerting version of the query above](/postgres/08-production/long-and-idle-transactions).

## Further reading

- [PostgreSQL docs: Recovering Disk Space](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [PostgreSQL docs: `pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/04-mvcc/history-list-length)
