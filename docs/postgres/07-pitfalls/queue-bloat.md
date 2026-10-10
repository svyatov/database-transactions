# A hung worker turns queue throughput into disk

This is a measured local schedule, not a production incident or an autovacuum test. On PostgreSQL 18.6 with 8 KiB heap pages, one worker holds job 1 while another completes 1001 jobs. The table still has 1200 rows, but its heap grows from 9 to 17 pages. Manual VACUUM leaves the occupied tuple-slot count unchanged until the first worker commits and another VACUUM runs.

The [job queue](/postgres/05-patterns/job-queue) supplies the selection and completion pattern. Task names are stored strings: this Scenario sends no email and tests no process crash, workload rate, or external delivery guarantee.

## Watch the meter climb

<!--@include: ./parts/queue-bloat.md-->

A begins at READ COMMITTED and locks job 1. The monitoring query asserts an assigned `backend_xid`. This does not establish the transaction-wide REPEATABLE READ snapshot in the [long-transactions lesson](/postgres/04-mvcc/long-transactions). An old assigned xid can also constrain the removal horizon; it does not mean that A can read every intermediate version. The Scenario does not assert a null `backend_xmin`: client-protocol snapshot lifetime is not the same as the isolation-level contract.

B skips locked job 1, selects job 2, updates it, and commits. The `drain` procedure repeats the selection, update, and per-job commit 250 times, then 750 times. The heap sizes are asserted as 9, 11, and 17 pages. Another query asserts 1200 current rows: 1001 `done` and 199 `queued`. These numbers depend on this layout and schedule; they do not predict production bytes per job.

The page-inspection query counts 2201 normal occupied line pointers. The 1001 extra tuple slots remain after the first VACUUM. This does not prove that VACUUM did no other maintenance, that autovacuum ran, or that every table's cleanup stopped. After A commits, the second VACUUM reduces the count to 1200. Commit alone does not reclaim those slots.

† The horizon explanation is an Entailed inference from PostgreSQL 18's [old-transaction cleanup guidance](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND) and [transaction identifiers](https://www.postgresql.org/docs/18/transaction-id.html). The asserted counts demonstrate this schedule, not every possible hung-worker schedule. A retained snapshot and an assigned xid are different diagnostics.

## The file stays big anyway

The final asserted heap size is still 17 pages. PostgreSQL's [space-recovery contract](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) says ordinary VACUUM "marks the space available for future reuse". It can also truncate entirely empty trailing pages when the required exclusive lock is obtainable. Thus, unchanged size here is not a rule that ordinary VACUUM can never return space to the operating system.

`VACUUM FULL`, `CLUSTER`, and other table rewrites can compact a table, with locking and temporary-space costs. None runs here. File size alone cannot distinguish occupied tuple slots from reusable space, and an occupied-slot count is not a measurement of free bytes or index bloat.

## The fix is upstream

Operational advice: investigate the transaction holding the old horizon and reduce its lifetime. Vacuum tuning does not remove that transaction's visibility requirement. A short claimed-state transaction with stale-claim recovery is a different queue design; this site does not implement or verify its reaper, fencing, or duplicate-effect handling. Choose those policies before moving external work outside the transaction.

The [vacuum dashboard](/postgres/08-production/bloat-and-vacuum-health) uses estimated statistics, not this page-inspection count. Combine those estimates with transaction horizons and file-size trends. No alert threshold or guaranteed early warning is established by this run.

## Further reading

- [PostgreSQL 18: Recovering Disk Space](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [Long transactions and reclamation](/postgres/04-mvcc/long-transactions)
- [The queue's database-local boundary](/postgres/05-patterns/job-queue)
