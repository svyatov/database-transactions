# History list health at a glance

Chapter 4 proved the mechanism:
[one idle reader pins the undo of every later commit](/mysql/04-mvcc/history-list-length).
This is the production version: the two queries that turn "the undo tablespace keeps
growing" from a mystery into a name:

<!--@include: ./parts/history-list-health.md-->

## Turning it into monitoring

The metric to graph is `trx_rseg_history_len` from
`information_schema.INNODB_METRICS`, the queryable form of the `History list length` you'd
otherwise read off `SHOW ENGINE INNODB STATUS`. The
[manual's baseline](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
is "typically a low value, usually less than a few thousand", so what you alert on is
*sustained* growth, never an absolute number. A write burst spikes the value and purge
absorbs the spike on its own; a line that climbs and stays climbed is the signal you care
about.

Once it does stay grown, the second query names the culprit. The oldest read view (the
`ORDER BY trx_started LIMIT 1` row) is purge's entire blocker, so ending that one
transaction drains the backlog with no further action from you. What you shouldn't do is
reach for purge tuning ([`innodb_purge_threads` and friends](/mysql/04-mvcc/purge)) while
the oldest transaction is hours old. Purge isn't slow here; it's *forbidden*, and no
amount of tuning lifts a ban.

Unlike PostgreSQL there's no table-level bloat to inspect and no
[VACUUM scheduling to audit](/postgres/08-production/bloat-and-vacuum-health). Undo
lives centrally, so this one metric plus one attribution query is the whole checkup.

Undo growth stays invisible in query latency right up until it doesn't: version chains
lengthen, the undo tablespace fills, and by then you're already in the incident. Catch it
on the graph instead, where a slow climb in `trx_rseg_history_len` buys you days of warning
and hands you a single transaction to go end.

## Further reading

- [MySQL docs: Purge Configuration](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
- [The PostgreSQL counterpart: bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health)
