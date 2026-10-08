# Read views: when your snapshot is taken

At MySQL 8.4 InnoDB REPEATABLE READ, consistent reads use a read view and can also see the
transaction's own earlier changes. The
[consistent-read contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
places the persistent view at the first consistent read, not BEGIN. READ COMMITTED instead
uses a fresh snapshot for each consistent read; locking reads use different rules.

## BEGIN takes no snapshot: the first read does

R first sees A's update committed after BEGIN. With `START TRANSACTION WITH CONSISTENT SNAPSHOT`,
R instead retains the earlier balance. The
[START TRANSACTION manual](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
limits that snapshot modifier to REPEATABLE READ; it does not change the isolation level.

<!--@include: ./parts/read-views.md-->

## Readers are free

The [read-only optimization contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-ro-txn.html)
allows InnoDB to avoid a persistent transaction ID for nonlocking read-only work. This is
an allocation optimization, not proof that reads cost nothing or that every declared
read-only transaction avoids an ID.

The transcript observes `INNODB_TRX.trx_id` above 2^48 for R before its first write, then
below that threshold after it writes. That numeric placeholder is an observation on the
verified build, not a public ID-format contract or a guarantee that real IDs never reach it.
The [TRX_ID documentation](https://dev.mysql.com/doc/refman/8.4/en/information-schema-innodb-trx-table.html)
is the contract to use when interpreting transaction information.

An idle read view can still retain undo. A cheap allocation does not make an indefinitely
open transaction harmless. Next: [history-list growth](/mysql/04-mvcc/history-list-length).

## Further reading

- [The PostgreSQL counterpart](/postgres/04-mvcc/snapshots-under-the-hood)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-mvcc) records the exact manual support and execution limits for this lesson.
