# History list health at a glance

Chapter 4 proved the mechanism —
[one idle reader pins the undo of every later commit](/mysql/04-mvcc/history-list-length).
This is the production version: the two queries that turn "the undo tablespace keeps
growing" from a mystery into a name:

<!--@include: ./parts/history-list-health.md-->

## Turning it into monitoring

- **The metric**: `trx_rseg_history_len` from `information_schema.INNODB_METRICS` — the
  queryable form of `History list length` in `SHOW ENGINE INNODB STATUS`. The
  [manual's baseline](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html):
  "typically a low value, usually less than a few thousand". Graph it; alert on
  *sustained growth*, not on any absolute number — write bursts spike it harmlessly,
  and purge absorbs those on its own.
- **The attribution**: when it grows and stays grown, the second query names the oldest
  read view. The `ORDER BY trx_started LIMIT 1` row is purge's whole blocker — end that
  transaction and the backlog drains without any further action from you.
- **What NOT to do**: don't reach for purge tuning
  ([`innodb_purge_threads` and friends](/mysql/04-mvcc/purge)) while the oldest
  transaction is hours old. Purge isn't slow; it's *forbidden*.

Unlike PostgreSQL there's no table-level bloat to inspect and no
[VACUUM scheduling to audit](/postgres/08-production/bloat-and-vacuum-health) — undo
lives centrally, so this one metric plus one attribution query is the whole checkup.

## Key takeaways

- Alert on sustained `trx_rseg_history_len` growth; spikes that drain are normal
  operation.
- The culprit query (oldest `trx_started` in `innodb_trx`) turns the alert into a
  session name — the fix is ending a transaction, not tuning purge.
- Undo growth is invisible in query latency until it isn't (bigger version chains, fuller
  undo tablespaces) — catch it on the graph, not in the incident.

## Further reading

- [MySQL docs: Purge Configuration](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)
- [The PostgreSQL counterpart: bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health)
