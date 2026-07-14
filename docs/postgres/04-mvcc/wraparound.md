# Transaction ID wraparound

One honest exception in this project: wraparound is the one claim we can't prove with a runnable
scenario: forcing it means burning through ~2 *billion* transaction ids. So this page is prose,
built directly on the
[manual's wraparound section](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND),
and everything testable about the machinery (xids, snapshots, vacuum) was already proven in the
previous lessons.

## The problem: xids are 32-bit and circular

Every `xmin` and `xmax` you saw in this chapter is a 32-bit counter. Four billion values, then it
wraps to the beginning. Visibility comparisons ("did this xid commit before my snapshot?")
therefore use circular arithmetic: for any xid, two billion ids are "in the past" and two billion
are "in the future".

Now recall the [row-versions lesson](/postgres/04-mvcc/row-versions): a committed row is visible
because its `xmin` is "in the past". If that row sits there untouched while the counter advances,
it crosses over. The manual:
["If the row version still exists after more than two billion transactions, it will suddenly appear to be in the future"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND).
A row "in the future" is invisible to every snapshot. Committed data, still on disk, readable by
no one: catastrophic data loss in effect, even though nothing was deleted.

## The fix: freezing

VACUUM prevents this by *freezing* old rows: any row version older than
[`vacuum_freeze_min_age`](https://www.postgresql.org/docs/current/runtime-config-vacuum.html#GUC-VACUUM-FREEZE-MIN-AGE)
(50 million xids by default) is marked frozen, flagged as inserted so far in the past that it's
["certain to be visible to all current and future transactions"](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND),
its actual `xmin` no longer consulted. This is the second job of the vacuums you met in the
[previous lesson](/postgres/04-mvcc/vacuum), and it's why vacuum isn't optional: even an
append-only, never-updated, zero-bloat table has to be vacuumed eventually, purely for freezing.

Two safety nets sit behind autovacuum. The first: once a table's oldest unfrozen xid passes
[`autovacuum_freeze_max_age`](https://www.postgresql.org/docs/current/runtime-config-vacuum.html#GUC-AUTOVACUUM-FREEZE-MAX-AGE)
(200 million by default), autovacuum launches an anti-wraparound vacuum on it, even if autovacuum
is otherwise disabled. The second is the last line of defense: if that vacuum never completes (blocked by the same enemies as always, a [long-running transaction](/postgres/04-mvcc/long-transactions),
an orphaned replication slot, a forgotten prepared transaction), the server starts warning 40
million xids before the cliff, and with 3 million left it
[refuses to assign new xids](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND)
rather than corrupt visibility. That's a write outage, not a full one: reads keep working, writes
fail, and running `VACUUM` still works and is the way out. (The single-user-mode ritual of old
versions is [no longer necessary or desirable](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND).)

## Watching the clock

The distance to trouble is one query away (illustrative;
[chapter 8 turns it into an alert](/postgres/08-production/bloat-and-vacuum-health)):

```sql
SELECT datname, age(datfrozenxid) AS oldest_unfrozen_age
FROM pg_database
ORDER BY age(datfrozenxid) DESC;
```

`age(...)` counts xids consumed since the database's oldest unfrozen xid. Healthy systems hover in
the low hundreds of millions (autovacuum resets the clock at 200 M by default); sustained growth
toward a billion means anti-wraparound vacuums aren't finishing.

The reassuring part is that none of this is exotic. Wraparound is the routine consequence of a
32-bit counter, held at bay by routine freezing, and it only becomes an incident when vacuum is
prevented from finishing for hundreds of millions of transactions. The blockers are this chapter's
usual suspects: long transactions, abandoned replication slots, unresolved prepared transactions.
So the practical advice is short: never disable autovacuum, and alert on `age(datfrozenxid)` long
before PostgreSQL starts refusing writes. Find out what's holding the horizon now, not at two
billion.

## Further reading

- [PostgreSQL docs: Preventing Transaction ID Wraparound Failures](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-WRAPAROUND)
- [PostgreSQL docs: Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
