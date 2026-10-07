# Row versions: xmin, xmax, ctid

PostgreSQL 18's [system-column contract](https://www.postgresql.org/docs/18/ddl-system-columns.html) distinguishes a logical row from its physical tuple versions. UPDATE creates a new version; the old version can remain while snapshots need it. DELETE does not immediately remove the old version. These MVCC rules do not eliminate table-lock or locking-read waits.

| column | meaning |
|---|---|
| `xmin` | xid of the transaction that inserted this tuple version |
| `xmax` | deleting transaction's xid, or zero for an undeleted version; a nonzero value can belong to a visible version. Row locking and MultiXacts also use the tuple header, so do not use a nonzero value alone as proof of deletion. |
| `ctid` | physical tuple address `(page, slot)`; changes with UPDATE and may change with VACUUM FULL |

## Watching an UPDATE make a copy

<!--@include: ./parts/row-versions.md-->

A's update returns balance 200 at `(0,2)`. B's older Repeatable Read snapshot still returns balance 100 at `(0,1)` with the updater's xid in `xmax`. After B commits, its new read returns the new version. The asserted pageinspect fields show both tuples and the old tuple's successor pointer. This small page layout is demonstrated, not a guarantee of consecutive slots for every update.

## DELETE is a stamp, not an eraser

The DELETE's returned xid and the inspected page fields are asserted alongside zero live rows. Both tuple bodies still appear in this observation. Later pruning or VACUUM may reclaim them. In-place header changes do occur: visibility hints and row locks are examples, so “nothing ever changes in place” would be too broad. [HOT](https://www.postgresql.org/docs/18/storage-hot.html) can reuse space during ordinary access when its conditions permit.

Use a primary key as the stable logical identifier, not ctid. The [snapshot lesson](/postgres/04-mvcc/snapshots-under-the-hood) relates versions to visibility, and [VACUUM](/postgres/04-mvcc/vacuum) shows reclamation. Row-lock encoding and MultiXact members are documented by the [transaction-information functions](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT); this schedule does not execute every encoding.

## Further reading

- [PostgreSQL 18: System Columns](https://www.postgresql.org/docs/18/ddl-system-columns.html)
- [PostgreSQL 18: pageinspect](https://www.postgresql.org/docs/18/pageinspect.html)
- [The same lesson on MySQL](/mysql/04-mvcc/undo-logs)
