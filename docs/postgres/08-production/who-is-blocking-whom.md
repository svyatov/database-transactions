# Who is blocking whom

Chapter 3 explained [lock queues](/postgres/03-locking/lock-queues) and
[how to read pg_locks](/postgres/03-locking/monitoring-locks); this is the 3 a.m. version. One
query, paste it as-is, and it answers the three questions that matter: *who is stuck,
who is the blocker, and what is the blocker doing?*

<!--@include: ./parts/who-is-blocking-whom.md-->

## Reading the answer

The transcript shows the classic production shape: the blocker's state is
**`idle in transaction`** — it isn't running anything, it's *holding* things (locks it
took [that live until COMMIT](/postgres/03-locking/row-locks)) while the application forgot about
it. `blocker_last_query` shows the last statement it ran, which is usually all you need
to find the guilty code path.

Two escalation levels, straight from the manual:

- [`pg_cancel_backend`](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL):
  ["Cancels the current query of the session whose backend process has the specified process ID"](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL) —
  polite, but useless against an *idle* blocker: there is no current query to cancel.
- [`pg_terminate_backend`](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL):
  ["Terminates the session whose backend process has the specified process ID"](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL) —
  the whole session dies and its transaction rolls back, which is exactly what the
  transcript shows freeing the queue.

## Key takeaways

- Memorize (or bookmark) the join: `pg_stat_activity` waiter × `pg_blocking_pids()` ×
  `pg_stat_activity` blocker. It names names, in one round trip.
- An idle-in-transaction blocker can only be terminated, not canceled — and killing it
  rolls back its work. Fix the code that leaves transactions open;
  [the next lesson](/postgres/08-production/long-and-idle-transactions) hunts those down.
- Termination is a rollback, and [a rollback is safe](/postgres/01-basics/what-is-a-transaction) —
  that's the whole point of transactions. Killing a blocker never corrupts data.

## Further reading

- [PostgreSQL docs: Server Signaling Functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL)
- [PostgreSQL docs: pg_stat_activity](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
