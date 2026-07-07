# Symptom triage

Production transaction bugs announce themselves as one of five symptoms. Each row maps a
symptom to the lesson that proves the mechanism and the lesson that fixes it — this page
is the index you paste into the incident channel.

| Symptom | First check | Mechanism | Fix |
|---|---|---|---|
| Updates hang, then finish | [Who is blocking whom](/mysql/08-production/who-is-blocking-whom) | [lock queues](/mysql/03-locking/lock-queues) | end the blocker; [shorter transactions](/mysql/08-production/long-and-idle-transactions) |
| Updates hang, then errno `1205` | [Who is blocking whom](/mysql/08-production/who-is-blocking-whom) | [lock wait timeout — statement rollback only!](/mysql/03-locking/nowait-skip-locked) | retry after ROLLBACK; find the blocker |
| Errno `1213` in the logs | [the deadlock counter](/mysql/08-production/logs-and-counters) | [deadlocks](/mysql/03-locking/deadlocks), [gap locks](/mysql/03-locking/gap-locks) | consistent lock order; [retry loop](/mysql/05-patterns/retrying-deadlocks) |
| INSERTs stuck with no row conflict | `data_locks` for `GAP` / `INSERT_INTENTION` | [gap locks](/mysql/03-locking/gap-locks) | READ COMMITTED for the writer, or narrower locking reads |
| Numbers wrong, no errors anywhere | [the anomaly catalog](/mysql/02-isolation/anomaly-catalog) | [lost updates](/mysql/02-isolation/lost-update), [write skew](/mysql/02-isolation/serializable) | [the three fixes](/mysql/05-patterns/fixing-lost-updates) |
| Disk grows, queries don't slow | [history list health](/mysql/08-production/history-list-health) | [an old read view pins purge](/mysql/04-mvcc/history-list-length) | end the long transaction |
| DDL hangs and takes the app with it | processlist: `Waiting for table metadata lock` | [metadata locks](/mysql/03-locking/table-locks-and-ddl) | `lock_wait_timeout` on the DDL session |

Two MySQL-specific reflexes worth building:

- **Errors that look alike aren't.** `1205` rolls back a *statement* (transaction still
  open, still holding locks); `1213` rolls back the *transaction*. Handling them
  identically is [pitfall material](/mysql/07-pitfalls/compendium).
- **Silence isn't health.** The costliest failures on this table — lost updates, write
  skew, purge lag — produce no errors at all. They're found by
  [counters](/mysql/08-production/logs-and-counters) and
  [invariant checks](/mysql/02-isolation/serializable), not by grepping logs.

## Further reading

- [The same triage for PostgreSQL](/postgres/08-production/symptom-triage)
