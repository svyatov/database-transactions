# Transaction ID wraparound

This page states PostgreSQL 18 Documented contracts from [Preventing Transaction ID Wraparound Failures](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND). No wraparound, freeze-age threshold, anti-wraparound launch, warning or stop condition is executed by a project Scenario. The preceding lessons demonstrate selected xid, snapshot and page-reclamation observations, not all this machinery.

## The problem: xids are 32-bit and circular

Tuple xmin/xmax use 32-bit identifiers. Circular ordering permits comparison within roughly half the identifier space. An unfrozen old insertion xid could otherwise appear to be in the future after about two billion assigned xids. This is a visibility hazard described by the manual, not observed data loss here. The [xid8 functions](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT) include an epoch and are a different representation.

## The fix: freezing

VACUUM marks sufficiently old eligible tuple versions frozen so future visibility checks do not depend on their normal insertion-xid ordering. In current PostgreSQL it uses tuple flags; the original xmin value is retained for inspection. A frozen insertion does not make a subsequently deleted tuple visible forever. Freezing still obeys safe visibility horizons; vacuum_freeze_min_age is an eligibility setting, not a promise that every older version is frozen on every pass.

PostgreSQL 18's [vacuum settings](https://www.postgresql.org/docs/18/runtime-config-vacuum.html) document a default vacuum_freeze_min_age of 50 million and autovacuum_freeze_max_age of 200 million. Anti-wraparound autovacuum can run even when ordinary autovacuum is disabled. The maximum age triggers maintenance; it does not guarantee completion or reset every database's age precisely at 200 million.

The [wraparound section](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND) documents warnings with 40 million xids left and refusal to assign new xids with three million left. Operations that need no new xid can continue; VACUUM remains available for recovery. Do not assume all SELECTs succeed, since functions or locking work can require resources beyond an ordinary read. Old snapshots, unresolved prepared transactions, and replication-slot retention can obstruct cleanup. This page does not execute their recovery or outage behavior.

## Watching the clock

This query is illustrative, based on the [database catalog](https://www.postgresql.org/docs/18/catalog-pg-database.html) and [age function](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT):

```sql
SELECT datname, age(datfrozenxid) AS oldest_unfrozen_age
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
```

datfrozenxid summarizes the oldest unfrozen xid boundary for the database. Its age is xid distance, not elapsed time or a count of live rows. Choose alerts well before the documented stop boundary and investigate retention when age rises. [Chapter 8](/postgres/08-production/bloat-and-vacuum-health) provides monitoring follow-up; no healthy-age distribution is measured here.

## Further reading

- [PostgreSQL 18: Preventing Wraparound Failures](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND)
- [PostgreSQL 18: Vacuum settings](https://www.postgresql.org/docs/18/runtime-config-vacuum.html)
