# Symptom triage

Use these symptoms to choose a diagnostic starting point. They are hypotheses, not measured incident frequencies or a complete production runbook. The linked Scenarios demonstrate particular schedules on PostgreSQL 18.6; a matching symptom does not by itself prove the same cause.

| Symptom | Candidate cause | Start here |
|---|---|---|
| Queries hang or latency spikes | A conflicting lock holder or an earlier incompatible waiter | [Who is blocking whom](/postgres/08-production/who-is-blocking-whom), [Table locks & DDL](/postgres/03-locking/table-locks-and-ddl) |
| Numbers violate the intended rule without an error | A stale read-modify-write or cross-row write skew | Inspect the actual writer paths; [single-row repairs](/postgres/05-patterns/fixing-lost-updates) and [Serializable](/postgres/02-isolation/serializable) address different rules. |
| The application pool fills | Idle transactions, long active work, or connection-use problems | [Long & idle transactions](/postgres/08-production/long-and-idle-transactions), [ORM pitfalls](/postgres/05-patterns/orm-pitfalls). No pool is executed by these Scenarios. |
| A table stays large after deletion | Unreclaimed versions, reusable internal space, or another size contributor | [Bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health), [Long transactions](/postgres/04-mvcc/long-transactions) |
| `40001` or `40P01` errors recur | A serialization conflict or deadlock | [Logs & counters](/postgres/08-production/logs-and-counters), [bounded full-transaction retry](/postgres/05-patterns/retrying-serialization-failures). Retrying can exhaust its budget; external effects need separate handling. |
| Locks remain without a live owner session | Prepared work is one possibility | `SELECT gid FROM pg_prepared_xacts;`, then [coordinated recovery](/postgres/06-distributed/two-phase-commit). This lists prepared work, not only orphaned work. |

Set meaningful `application_name` values to help connect database activity to application work. The runner names its Sessions; that does not establish that every production query has a meaningful name or that monitoring permission is automatic. Combine state, queries, lock relationships, and transaction horizons with application context.

The [alerting checklist](/postgres/08-production/alerting-checklist) suggests investigation signals and explicitly tunable policies. It does not prove that every incident has an early warning or that the listed limits prevent failures.

## Further reading

- [The same triage for MySQL](/mysql/08-production/symptom-triage)
