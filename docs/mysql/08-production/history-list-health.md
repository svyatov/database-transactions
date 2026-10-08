# History list health at a glance

For MySQL 8.4 InnoDB, the [chapter 4 schedule](/mysql/04-mvcc/history-list-length) retains an old REPEATABLE READ view while updates commit. Here, 150 updates commit, the history-list metric is at least 150, and R still reads its original value. The detector identifies R as the oldest tagged transaction in this controlled run.

<!--@include: ./parts/history-list-health.md-->

## Turning it into monitoring

`trx_rseg_history_len` is a history-list measure, not retained bytes or disk usage. Graph it with transaction age and workload. Sustained growth is a reason to investigate, not proof of one forgotten reader. Write volume and purge capacity also matter. Choose thresholds from your workload and recovery objectives; this run establishes none.

The oldest `trx_started` row is a candidate, not the oldest read view by definition: the query reports transaction start time, not snapshot creation time. The demonstration knows when R opened its view because it controls the schedule. A production query alone does not supply that knowledge. Confirm the candidate's isolation, reads, and concurrent work before ending it.

The [MySQL 8.4 purge manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html) states: "Purge runs on a periodic schedule." Ending a retaining reader permits cleanup of history it required; other readers and background work determine what follows. The scenario does not assert drainage, tablespace shrinkage, latency, or warning time. Investigate [purge configuration](/mysql/04-mvcc/purge) as well as retaining readers.

## Further reading

- [MySQL docs: Purge Configuration](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
- [The PostgreSQL counterpart: bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health)
