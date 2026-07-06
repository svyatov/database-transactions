# Row versions: xmin, xmax, ctid

Chapters 2 and 3 kept saying "snapshot" and "row version" — this chapter opens the hood.
The core trick of MVCC is that PostgreSQL **never modifies a row in place**: every UPDATE
writes a complete new copy, every DELETE just marks the old one. That's why
[reading never blocks writing and writing never blocks reading](https://www.postgresql.org/docs/current/mvcc-intro.html) —
readers and writers are literally looking at different physical tuples.

Three [hidden system columns](https://www.postgresql.org/docs/current/ddl-system-columns.html)
tell each version's story:

| column | meaning |
|---|---|
| `xmin` | the transaction id (xid) that **created** this version |
| `xmax` | the xid that **deleted or replaced** it — `0` while nobody has |
| `ctid` | its physical address: `(page, slot)` within the table file |

## Watching an UPDATE make a copy

<<< ../../scenarios/04-mvcc/row-versions.ts#demo{ts}

<!--@include: ./parts/row-versions.md-->

The subtle beat in the middle: after A's update, **B's row suddenly shows a non-zero
`xmax`** — while still reading the old balance. B is looking at the *old version*, and the
old version now carries the xid of the transaction that replaced it. The manual notes that
a visible row version can have non-zero `xmax` —
["that usually indicates that the deleting transaction hasn't committed yet, or that an attempted deletion was rolled back"](https://www.postgresql.org/docs/current/ddl-system-columns.html) —
and B's case is the third flavor: the deletion committed, but B's snapshot predates it.

Then `heap_page_items` (from the
[pageinspect extension](https://www.postgresql.org/docs/current/pageinspect.html)) drops all
pretense: both versions sit on page 0, and the old tuple's `t_ctid` points at its successor
`(0,2)` — the version chain PostgreSQL walks to find the current row.

## DELETE is a stamp, not an eraser

<<< ../../scenarios/04-mvcc/row-versions.ts#delete{ts}

`SELECT` finds nothing; the disk still holds every byte. In PostgreSQL,
["an UPDATE or DELETE of a row does not immediately remove the old version of the row"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY) —
removal is [VACUUM's](/04-mvcc/vacuum) job, and the [bloat lesson](/04-mvcc/dead-tuples-and-bloat)
shows what piles up in the meantime.

## Key takeaways

- **UPDATE = write new version + stamp old version's `xmax`. DELETE = stamp `xmax`.**
  Nothing is ever changed in place; nothing is immediately removed.
- `xmin`/`xmax` are how PostgreSQL knows *which transaction* created and killed each
  version — the [snapshot lesson](/04-mvcc/snapshots-under-the-hood) shows how visibility
  is computed from them.
- `ctid` changes on every update (and on `VACUUM FULL`) — never store it as a row
  identifier; use a primary key.
- This is also why [`SELECT FOR UPDATE` writes to disk](/03-locking/row-locks) (row locks
  live in the row header) and why an update-heavy table needs VACUUM to stay small.

## Further reading

- [PostgreSQL docs: System Columns](https://www.postgresql.org/docs/current/ddl-system-columns.html)
- [PostgreSQL docs: Introduction to MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [PostgreSQL docs: pageinspect](https://www.postgresql.org/docs/current/pageinspect.html)
