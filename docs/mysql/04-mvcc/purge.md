# Purge: the VACUUM you never run

MySQL 8.4 InnoDB uses background purge to discard eligible update undo and physically remove
delete-marked rows and index records. Eligibility depends on MVCC and rollback requirements.
This [Documented contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
is distinct from a demonstrated completion deadline.

::: info Where's the transcript?
This page has no scenario of its own. [History-list growth](/mysql/04-mvcc/history-list-length)
and [old-row visibility](/mysql/04-mvcc/undo-logs) demonstrate retention and visibility.
They do not measure when purge finishes, guarantee eventual drainage under sustained load,
or prove that undo tablespace files shrink after a reader ends.
:::

## What there is to tune

The same manual documents `innodb_purge_threads` (parallelism), `innodb_purge_batch_size`
(pages per batch), and `innodb_max_purge_lag` (write delays when purge lag exceeds the configured
threshold, disabled at zero). These are tuning controls, not measurements from this site.

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
