# The history list: InnoDB's bloat metric

For MySQL 8.4 InnoDB, history-list length tracks committed update undo awaiting purge.
It is not a byte count, row-version count, or a complete measure of table or undo-file bloat.
The [purge manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
describes history retention under write-heavy workloads and long-running read transactions.

## One idle reader, two hundred pinned transactions

R creates a REPEATABLE READ view at `v=0`. A commits 200 single-row updates. The scenario
asserts `trx_rseg_history_len >= 200` while R still reads zero. It does not assert an exact
increase of 200, inspect undo pages, or time the later purge.

<!--@include: ./parts/history-list-length.md-->

## The PostgreSQL parallel is limited {#the-postgresql-parallel-is-exact}

Both engines can retain history behind an old snapshot, but this does not make InnoDB purge
and [PostgreSQL VACUUM](/postgres/04-mvcc/long-transactions) identical. InnoDB maintains undo
and also removes delete-marked index records; PostgreSQL manages heap tuple versions.

An old read view can prevent purge of history it may need even when the reader is idle.
Growth requires continued production of retained update undo; an open transaction without
a read view is not by itself proof of that retention. Not every committed write adds the
same history, and ending R only removes its retention requirement. Other readers and purge
capacity can still matter.

Monitor the trend of `trx_rseg_history_len`, also displayed as `History list length` in
`SHOW ENGINE INNODB STATUS`. Investigate old read views and write load rather than diagnosing
a forgotten transaction from this counter alone. The [production query](/mysql/08-production/history-list-health)
uses the same metric. Next: [purge](/mysql/04-mvcc/purge).

## Further reading

- [MySQL docs: Undo Logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-mvcc) records the exact manual support and execution limits for this lesson.
