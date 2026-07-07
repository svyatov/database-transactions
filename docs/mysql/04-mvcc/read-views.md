# Read views: when your snapshot is taken

InnoDB calls a snapshot a **read view**: the set of transactions whose changes you're
allowed to see. [Chapter 2](/mysql/02-isolation/repeatable-read) used snapshots to explain
isolation; this lesson pins down the mechanics — *when* the view is created, and what it
costs (almost nothing).

The timing rule, per the
[manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html): "all
consistent reads within the same transaction read the snapshot established by the **first
such read** in that transaction." Not by `BEGIN` — by the first read. A transaction that
has begun but not yet read has no opinions about the world at all:

## BEGIN takes no snapshot — the first read does

<!--@include: ./parts/read-views.md-->

## Readers are free

The last part of the transcript shows something PostgreSQL users don't expect: the idle
reader's `trx_id` is fake. The
[manual](https://dev.mysql.com/doc/refman/8.4/en/information-schema-innodb-trx-table.html)
on `INNODB_TRX.TRX_ID`: "A unique transaction ID number, internal to `InnoDB`. These IDs
are not created for transactions that are read only and nonlocking." And
[why](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-ro-txn.html): "A
transaction ID is only needed for a transaction that might perform write operations or
locking reads such as SELECT ... FOR UPDATE" — so "`InnoDB` can avoid the overhead
associated with setting up the transaction ID (TRX_ID field) for transactions that are
known to be read-only."

What `information_schema.innodb_trx` shows for such a transaction is a placeholder above
2⁴⁸, where real IDs never reach — the boolean in the transcript is exactly that check. The
moment the transaction writes, a real ID is allocated and stamped into every row it
touches (`DB_TRX_ID`, [previous lesson](/mysql/04-mvcc/undo-logs)).

## Key takeaways

- The read view is created by the transaction's **first consistent read** — `BEGIN` alone
  pins nothing. Need the snapshot to start immediately? `START TRANSACTION WITH CONSISTENT
  SNAPSHOT`.
- A gap between `BEGIN` and the first SELECT is a window where the world can still move —
  the same trap as PostgreSQL's "snapshot at first statement" rule
  ([compare](/postgres/04-mvcc/snapshots-under-the-hood)).
- Read-only transactions never allocate a transaction ID — reading is designed to be
  cheap. The expensive thing a reader does is *staying open*
  ([next lesson](/mysql/04-mvcc/history-list-length)).

## Further reading

- [MySQL docs: Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
- [MySQL docs: Optimizing InnoDB Read-Only Transactions](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-ro-txn.html)
