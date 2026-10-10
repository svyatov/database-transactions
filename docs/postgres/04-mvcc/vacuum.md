# VACUUM

PostgreSQL 18 [documents standard VACUUM](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) as reclaiming obsolete versions for reuse. It can return wholly empty trailing heap pages when the required exclusive lock is available. VACUUM FULL instead rewrites the relation to compact it. Neither observation here promises an exact size for arbitrary tables.

## What VACUUM actually does to a page

<!--@include: ./parts/vacuum.md-->

The asserted counters page has a redirect at slot 1, unused slots 2 and 3, and a live tuple at slot 4. The next INSERT asserts ctid `(0,2)`, showing reuse in this setup. [pageinspect](https://www.postgresql.org/docs/18/pageinspect.html) exposes those fields; the PostgreSQL 18 [item-id definitions](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/storage/itemid.h) define flags 0 (unused), 1 (normal) and 2 (redirect). [HOT](https://www.postgresql.org/docs/18/storage-hot.html) requires sufficient page space and no changed indexed columns except summarizing indexes; this is not a rule that every non-indexed UPDATE makes the same chain layout.

## Why your table didn't shrink

In bloat the asserted size is nine pages after standard VACUUM and five after VACUUM FULL. The nine-page result alone does not count reclaimed tuples or measure all reusable space. The counters observation demonstrates reclamation separately.

[VACUUM FULL](https://www.postgresql.org/docs/18/sql-vacuum.html) requires ACCESS EXCLUSIVE and extra storage for the new copy until the rewrite finishes. Ordinary reads and writes from other transactions cannot acquire their table locks while that lock is held. Exact extra storage, rewrite duration and production acceptability depend on the relation and workload; no “double disk” benchmark is established here.

Standard VACUUM uses SHARE UPDATE EXCLUSIVE, compatible with ordinary table reads and writes but conflicting with some maintenance and DDL. Its optional trailing-page truncation can require ACCESS EXCLUSIVE. Autovacuum performs standard vacuuming, not VACUUM FULL. Regular maintenance can promote reuse, but neither stable table size nor zero blocking is a universal guarantee. Check [old snapshots](/postgres/04-mvcc/long-transactions) and other retention conditions when cleanup cannot reclaim the needed versions.

## Further reading

- [PostgreSQL 18: Recovering Disk Space](https://www.postgresql.org/docs/18/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [PostgreSQL 18: VACUUM](https://www.postgresql.org/docs/18/sql-vacuum.html)
- [The same lesson on MySQL](/mysql/04-mvcc/purge)
