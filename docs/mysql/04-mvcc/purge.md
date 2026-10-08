# Purge: the VACUUM you never run

MySQL 8.4 InnoDB uses background purge to discard eligible update undo and physically remove
delete-marked rows and index records. Eligibility depends on MVCC and rollback requirements.
The [MySQL 8.4 purge manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
limits removal to "after the row is no longer required for multi-version concurrency control (MVCC) or rollback".
This Documented contract supplies no demonstrated completion deadline.

::: info Where's the transcript?
This page has no scenario of its own. [History-list growth](/mysql/04-mvcc/history-list-length)
and [old-row visibility](/mysql/04-mvcc/undo-logs) demonstrate retention and visibility.
They do not measure when purge finishes, guarantee eventual drainage under sustained load,
or prove that undo tablespace files shrink after a reader ends.
:::

## What there is to tune

The [MySQL 8.4 variable reference](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_purge_threads)
describes `innodb_purge_threads` as "The number of background threads devoted to the InnoDB purge operation."
The purge system can use fewer threads than this maximum. The same reference defines
[`innodb_purge_batch_size`](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_purge_batch_size)
in undo-log pages and [`innodb_max_purge_lag`](https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html#sysvar_innodb_max_purge_lag)
as a threshold for delaying INSERT, UPDATE and DELETE while purge catches up. For a zero
threshold it specifies "no maximum purge lag and no delay". These are tuning controls,
not measurements from this site. The [support assessment](/audits/40-reconstructed-support#purge)
retains the exact parameter passages and their conditions.

Inspect old read views, write load, and the [history-list trend](/mysql/04-mvcc/history-list-length)
before choosing settings. Releasing a blocking read view permits more cleanup; it does not
force immediate completion. Discarding undo and truncating an undo tablespace are different
operations, as the [undo-tablespace manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-tablespaces.html)
explains. Purge also changes table/index storage by removing eligible delete-marked records;
undo retention is not the only source of storage growth or read cost.

There is no PostgreSQL-style per-table `VACUUM` command for purge, but its configuration and
workload still affect cleanup. Compare [VACUUM](/postgres/04-mvcc/vacuum), then continue to
[application patterns](/mysql/05-patterns/fixing-lost-updates).

## Further reading

- [MySQL docs: Undo Logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-mvcc) records the exact manual support and execution limits for this lesson.
