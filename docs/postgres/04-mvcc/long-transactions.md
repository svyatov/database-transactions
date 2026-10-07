<div id="long-transactions-block-vacuum" style="scroll-margin-top: calc(var(--vp-nav-height) + 48px)"></div>

# Tuple retention under an old snapshot

An old snapshot can prevent reclamation of obsolete versions. PostgreSQL 18's [vacuum contract](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) preserves versions that might still be visible to another transaction. This schedule holds a Repeatable Read snapshot over three updates to one jobs row.

<div id="vacuum-ran-cleaned-nothing" style="scroll-margin-top: calc(var(--vp-nav-height) + 48px)"></div>

## VACUUM leaves the inspected tuple fields unchanged

<!--@include: ./parts/long-transactions.md-->

The first VACUUM completes but the inspected `lp`, `t_xmin`, `t_xmax` and `t_ctid` fields remain unchanged. This is not a byte-for-byte comparison of the whole page, nor proof that VACUUM did no other work. A still reads only the original status `new`; its snapshot does not see each intermediate version. After A commits, the second VACUUM's asserted page fields show one redirect, two unused slots and the current tuple.

† A retained snapshot's removal horizon can constrain reclamation in other tables of the same database, even tables not read by that transaction. This inference follows PostgreSQL 18's [backend_xmin horizon](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) and vacuum's visibility requirement. The single-table transcript does not execute this cross-table guarantee. It does not imply all VACUUM or autovacuum work stops, or that every long transaction holds a transaction-wide old snapshot.

## Spotting the offender

This diagnostic query is illustrative; its columns are [Documented contracts](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW), not a new Scenario result:

```sql
SELECT pid, state, application_name,
       age(backend_xmin) AS snapshot_age_xids,
       now() - xact_start AS tx_duration
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC;
```

Inspect application state as well as age. An idle Read Committed transaction does not necessarily retain a Repeatable Read snapshot. Replication slots and prepared transactions can also constrain maintenance. Monitoring other sessions' details requires appropriate privileges.

The PostgreSQL 18 [client-setting contracts](https://www.postgresql.org/docs/18/runtime-config-client.html) document idle_in_transaction_session_timeout for idle open transactions, transaction_timeout for session transaction duration (introduced in 17, excluding prepared transactions), and statement_timeout for individual statement duration. Defaults are disabled for these timeouts; their interactions and suitable limits need application decisions. No timeout execution occurs in this chapter. [Chapter 8](/postgres/08-production/long-and-idle-transactions) supplies the operational follow-up.

## Further reading

- [PostgreSQL 18: Recovering Disk Space](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [PostgreSQL 18: pg_stat_activity](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/04-mvcc/history-list-length)
