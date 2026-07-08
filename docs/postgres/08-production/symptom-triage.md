# Symptom triage

Production doesn't page you about "isolation anomalies" — it pages you about latency,
weird numbers, and full connection pools. This chapter is the site in runbook order:
start from the symptom, run one query, land on the mechanism you already learned.

| Symptom | Usual suspect | Start here |
|---|---|---|
| Queries hang; latency spikes in bursts | A lock queue behind one long holder — often an idle transaction or unguarded DDL | [Who is blocking whom](/postgres/08-production/who-is-blocking-whom), [Table locks & DDL](/postgres/03-locking/table-locks-and-ddl) |
| Numbers don't add up; no errors logged | A [lost update](/postgres/02-isolation/lost-update) or [write skew](/postgres/02-isolation/serializable) — the silent ones | Grep the code for read-modify-write; fix with [these patterns](/postgres/05-patterns/fixing-lost-updates) |
| Connections pile up until the pool is empty | Sessions stuck `idle in transaction` | [Long & idle transactions](/postgres/08-production/long-and-idle-transactions), [ORM pitfalls](/postgres/05-patterns/orm-pitfalls) |
| Table keeps growing though rows are deleted | [Dead tuples](/postgres/04-mvcc/dead-tuples-and-bloat); VACUUM starved by a [long transaction](/postgres/04-mvcc/long-transactions) | [Bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health) |
| Sporadic `40001` / `40P01` errors under load | [Serialization failures](/postgres/02-isolation/serializable) and [deadlocks](/postgres/03-locking/deadlocks) — expected, must be retried | [Logs & counters](/postgres/08-production/logs-and-counters), [the retry wrapper](/postgres/05-patterns/retrying-serialization-failures) |
| Locks held but *no session* owns them | An orphaned [prepared transaction](/postgres/06-distributed/two-phase-commit) | `SELECT gid FROM pg_prepared_xacts;` |

Two habits make every row of this table easier. Name your sessions: every scenario on
this site sets `application_name`, and every triage query returns it, so one line in your
connection setup buys you readable `pg_stat_activity` forever. And alert before the page,
because most of these symptoms have a leading indicator, and the
[alerting checklist](/postgres/08-production/alerting-checklist) lists the handful worth
watching.

## Further reading

- [The same triage for MySQL](/mysql/08-production/symptom-triage)
