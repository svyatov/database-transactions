# Snapshots under the hood

[`pg_current_snapshot()`](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT) exposes top-level transaction-id visibility information. Its three components are not the complete tuple-visibility algorithm: commit/abort status, own writes, command order, subtransactions, frozen tuples and row-header flags also matter.

| component | meaning |
|---|---|
| `xmin` | lowest xid still active at snapshot time; smaller xids have completed, either committed or aborted |
| `xmax` | one past the highest completed xid in the documented representation; xids at or above it had not completed when the snapshot was taken |
| `xip` | in-progress top-level xids between the bounds; does not include subtransaction ids |

These are [Documented contracts, Table 9.85](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT). Completion alone is not commitment: a completed transaction can be aborted. This representation is a teaching aid for the schedule, not a substitute for PostgreSQL's visibility checks.

## The three numbers, live

<!--@include: ./parts/snapshots-under-the-hood.md-->

A's ordinary read has not assigned an xid, then its UPDATE assigns one. B updates a different row and commits. C takes a Repeatable Read snapshot: it asserts A at xmin and in xip, and xmax equal to B's xid plus one. Its table reads assert A's old value 100 and B's committed 200. A commits, but C's repeat still sees the same values. After C commits, its fresh read sees A's 150.

[`pg_current_xact_id()`](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT) can assign an xid even without a table write. Thus the observation that A's initial read had no xid is not a guarantee that read-only transactions never consume one. The [transaction-id chapter](https://www.postgresql.org/docs/18/transaction-id.html) documents lazy assignment and the distinction between 32-bit xid and epoch-extended xid8.

Under the [isolation contract](https://www.postgresql.org/docs/18/transaction-iso.html), ordinary Read Committed table reads take a new snapshot per command; Repeatable Read establishes its retained snapshot at the first non-transaction-control statement. Both can see their own earlier writes. UPDATE and locking SELECT can wait or reject changed rows under their level-specific rules. C's demonstration excludes A's newly committed version from an already retained snapshot; it does not make commit order irrelevant to which snapshot a later reader takes. No read-cost benchmark is claimed.

## Further reading

- [PostgreSQL 18: Snapshot Information Functions](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT)
- [PostgreSQL 18: Transactions and Identifiers](https://www.postgresql.org/docs/18/transaction-id.html)
- [The same lesson on MySQL](/mysql/04-mvcc/read-views)
