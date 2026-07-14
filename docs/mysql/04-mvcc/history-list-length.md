# The history list: InnoDB's bloat metric

PostgreSQL's version of this lesson is about [dead tuples](/postgres/04-mvcc/dead-tuples-and-bloat)
accumulating in tables. InnoDB keeps history out of the tables, but it accumulates all the
same, as undo log pages queued up for [purge](/mysql/04-mvcc/purge). The queue is the
*history list*, and its length is the single number that tells you whether MVCC hygiene
is keeping up.

The [manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html):
"Purge runs on a periodic schedule. It parses and processes undo log pages from the history
list, which is a list of undo log pages for committed transactions that is maintained by
the `InnoDB` transaction system." And the failure mode: "The `History list length` is
typically a low value, usually less than a few thousand, but a write-heavy workload or long
running transactions can cause it to increase, even for transactions that are read only."

Why can a transaction that *only reads* bloat the server? Because "a transaction must
return the same result as when the read view for that transaction was created.
Consequently, the `InnoDB` multi-version concurrency control (MVCC) system must keep a copy
of the data in the undo log until all transactions that depend on that data have completed."

Watch it happen:

## One idle reader, two hundred pinned transactions

<!--@include: ./parts/history-list-length.md-->

## The PostgreSQL parallel is exact

Swap the words and this is [the same lesson](/postgres/04-mvcc/long-transactions): one
forgotten open transaction pins garbage collection for the entire server, not only the
tables it read, because InnoDB only knows "this read view needs history from here back",
not which rows it will touch. The differences are where the garbage sits (undo tablespaces,
not table heaps) and who cleans it (purge threads, automatically, with no `VACUUM` to
run or tune).

The counter in the scenario, `trx_rseg_history_len` in `information_schema.INNODB_METRICS`,
is the same number the manual describes as "presented as the `History list length` value in
the `TRANSACTIONS` section of `SHOW ENGINE INNODB STATUS`". The metrics table is the
queryable form of that same number. Alert on it: a history list that grows and doesn't come back down means
either a runaway write burst or a transaction someone forgot to close, and
[the production chapter](/mysql/08-production/history-list-health) turns this into a
monitoring query.

Every committed write transaction adds to the history list, and purge drains it, but only
back as far as the oldest open read view, so a single idle `REPEATABLE READ` transaction pins
undo for every write that commits after its snapshot, and growth stays unbounded until it ends.
The number to watch is `trx_rseg_history_len` in `INNODB_METRICS`, the queryable form of
`History list length`; alert when it climbs and doesn't come back down. The classic culprit is
the reader that only looks at data, because nothing it does looks expensive, which raises the
question of what actually drains the list, and that's [purge](/mysql/04-mvcc/purge).

## Further reading

- [MySQL docs: Purge Configuration](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
- [The PostgreSQL counterpart: long transactions block VACUUM](/postgres/04-mvcc/long-transactions)
