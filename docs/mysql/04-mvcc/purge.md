# Purge: the VACUUM you never run

PostgreSQL's [VACUUM](/postgres/04-mvcc/vacuum) needs a whole lesson about when to run it,
what it can and can't reclaim, and how to tell whether autovacuum is keeping up. InnoDB's
equivalent is **purge**, and the headline is how little of that lesson transfers: purge is
a set of background threads, always on, with no command to invoke and no per-table
scheduling to tune.

What it does, per the
[manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html): "A row
and its index records are only physically removed when `InnoDB` discards the undo log
record written for the deletion. This removal operation, which only occurs after the row is
no longer required for multi-version concurrency control (MVCC) or rollback, is called a
purge." It's the second half of the delete-marking story from
[undo logs](/mysql/04-mvcc/undo-logs): DELETE marks, purge removes.

::: info Where's the transcript?
This page has no scenario of its own, deliberately. Purge's *inputs* are proven elsewhere —
[history piles up behind a read view](/mysql/04-mvcc/history-list-length), and
[delete-marked rows stay readable](/mysql/04-mvcc/undo-logs). But purge's *timing* is a
background heuristic: in our probing it sometimes drained hundreds of history entries in a
couple of seconds and sometimes sat on them for half a minute, depending on write activity.
"The history list drains eventually" is true and everything below is quoted from the
manual — but a deterministic, CI-stable transcript of *when* would be a lie, so we don't
print one. (The same honesty rule as
[PostgreSQL's wraparound lesson](/postgres/04-mvcc/wraparound).)
:::

## What there is to tune

Almost nothing, usually. The knobs exist for extreme cases:

- `innodb_purge_threads` — parallelism of the purge subsystem.
- `innodb_purge_batch_size` — undo log pages processed per batch.
- `innodb_max_purge_lag` — the emergency brake: when the history list exceeds this, InnoDB
  delays writes to let purge catch up. Off (0) by default.

If you find yourself reaching for these, the root cause is almost always upstream: a
long-running transaction holding the oldest read view, or a write burst purge will absorb
on its own. Check
[`trx_rseg_history_len`](/mysql/04-mvcc/history-list-length) before tuning anything.

## Key takeaways

- Purge = automatic, background, always-on garbage collection of undo history and
  delete-marked rows. There is no `VACUUM` command to run, schedule, or forget.
- Purge can only remove history older than the **oldest open read view** — the lever you
  control is transaction length, not purge settings.
- Undo lives in undo tablespaces, so "bloat" here inflates those files rather than your
  tables — table scans don't slow down the way PostgreSQL's do under dead-tuple bloat.

## Further reading

- [MySQL docs: Purge Configuration](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
- [MySQL docs: Undo Logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)
- [The PostgreSQL counterpart: VACUUM](/postgres/04-mvcc/vacuum)
