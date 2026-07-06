# VACUUM

VACUUM is the collector for the garbage [MVCC leaves behind](/postgres/04-mvcc/dead-tuples-and-bloat):
it removes dead tuples **and marks their space reusable — inside the file**. What it
almost never does is make the file smaller. This lesson proves both halves.

## What VACUUM actually does to a page

<<< ../../../scenarios/postgres/04-mvcc/vacuum.ts#demo{ts}

<!--@include: ./parts/vacuum.md-->

Reading the after picture (`lp_flags` values aren't in the manual — the
[pageinspect docs](https://www.postgresql.org/docs/current/pageinspect.html) point at
[`src/include/storage/itemid.h`](https://github.com/postgres/postgres/blob/master/src/include/storage/itemid.h)):
`1` = a normal tuple, `2` = a *redirect* — the chain's entry point now jumps straight to
the live version — and `0` = unused, free for the taking. The very next `INSERT` proves the point by landing in slot 2, previously a
corpse. (The redirect is a leftover of a
[HOT update chain](https://www.postgresql.org/docs/current/storage-hot.html) — updates
that don't touch indexed columns link versions within the page, and index entries keep
pointing at the root slot.)

## Why your table didn't shrink

<<< ../../../scenarios/postgres/04-mvcc/vacuum.ts#size{ts}

The manual says it plainly: the standard form of VACUUM
["removes dead row versions in tables and indexes and marks the space available for future reuse.
However, it will not return the space to the operating system, except in the special case
where one or more pages at the end of a table become entirely free and an exclusive table
lock can be easily obtained"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY).
`VACUUM FULL` is the real shrink — it
["actively compacts tables by writing a complete new version of the table file with no dead space"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) —
but it holds [`ACCESS EXCLUSIVE`](/postgres/03-locking/table-locks-and-ddl) for the whole rewrite:
a full outage on that table, plus double the disk while it runs. On a big production table
that's rarely acceptable; steady autovacuum that never lets bloat build up beats heroic
compaction.

## Key takeaways

- **VACUUM reclaims for reuse; VACUUM FULL reclaims for the OS.** Day-to-day you want the
  former, continuously, via autovacuum — reserve `VACUUM FULL` for genuine one-off
  disasters and schedule the outage.
- VACUUM runs alongside normal reads *and* writes — it takes only a weak lock
  ([`SHARE UPDATE EXCLUSIVE`](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES)).
  There is no good reason to switch autovacuum off; every "autovacuum is killing us" story
  ends with a table that needed it more, not less.
- A stable, bloated-but-recycling table is fine: new versions reuse freed slots, and size
  plateaus. Size that climbs without limit means vacuum can't keep up — check for a
  [long transaction](/postgres/04-mvcc/long-transactions) pinning the horizon.

## Further reading

- [PostgreSQL docs: Recovering Disk Space](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [PostgreSQL docs: VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html)
- [PostgreSQL docs: Heap-Only Tuples (HOT)](https://www.postgresql.org/docs/current/storage-hot.html)
