# Repeatable Read

At REPEATABLE READ — MySQL's default — the **first read** of the transaction takes one
snapshot, and every later *plain SELECT* reads from that same frozen view: no non-repeatable
reads, no phantoms.

But only plain SELECTs. UPDATE, DELETE, and `SELECT … FOR UPDATE/SHARE` are **current
reads**: they operate on the latest committed data, snapshot be damned. That asterisk is
where MySQL's RR differs most from PostgreSQL's — and where ported assumptions break.

## One snapshot, no phantoms

<!--@include: ./parts/stable-snapshot.md-->

## Current reads punch holes in the snapshot

Watch a single transaction read `100`, then compute `+50` *from a value it has never seen*,
then suddenly see `200`:

<!--@include: ./parts/current-reads.md-->

::: warning Porting from PostgreSQL?
PostgreSQL's REPEATABLE READ *refuses* to update a row that changed after your snapshot
(SQLSTATE `40001`, [see the PostgreSQL lesson](/postgres/02-isolation/repeatable-read)).
MySQL never raises that error: the write goes through against the current version. Retry
loops written for PostgreSQL have nothing to catch here — and
[lost updates](/mysql/02-isolation/lost-update) that PostgreSQL would have blocked go
undetected.
:::

## Key takeaways

- REPEATABLE READ = one snapshot per **transaction**, taken by the first read (not by
  `BEGIN`).
- Plain SELECTs are phantom-free at RR — stronger than the SQL standard requires.
- Writes and locking reads bypass the snapshot (**current reads**), and after you modify a
  row, your own SELECTs see the new version — the snapshot is not a wall, it's a default.
- No `40001`-style serialization errors exist at this level. The anomalies RR leaves open —
  [lost updates](/mysql/02-isolation/lost-update) and
  [write skew](/mysql/02-isolation/serializable) — must be handled with
  [locking reads](/mysql/03-locking/row-locks) or constraints.

## Further reading

- [MySQL docs: REPEATABLE READ](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_repeatable-read)
- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
