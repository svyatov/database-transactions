# Table locks & DDL

Row locks are what you fight over in application code. Table locks are what take your site
down during a deploy. Every statement — even a plain `SELECT` — locks every table it touches;
the modes usually don't conflict, so you never feel it. Then a migration shows up.

A `SELECT` takes `ACCESS SHARE`, the weakest table lock. `DROP TABLE`, `TRUNCATE`, and most
forms of `ALTER TABLE` take `ACCESS EXCLUSIVE` — the manual's rule for ALTER TABLE is that
["An ACCESS EXCLUSIVE lock is acquired unless explicitly noted"](https://www.postgresql.org/docs/current/sql-altertable.html) —
and `ACCESS EXCLUSIVE`
[conflicts with *all* modes](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES),
`ACCESS SHARE` included. So the strongest table lock and the weakest one can't coexist, which
is the entire story of a DDL outage compressed into one sentence.

On its own that's fine: the ALTER waits for running queries to finish, then does its
(often fast) work. The disaster needs one more ingredient — the [lock queue](/postgres/03-locking/lock-queues).

## The outage, reproduced

Picture three sessions. A long-lived transaction has already read the table and is sitting
there holding `ACCESS SHARE`. A migration asks for `ACCESS EXCLUSIVE` and can't have it, so it
waits. And here's the twist: once that migration is waiting, every plain `SELECT` that arrives
after it has to queue too.

```timeline
Session A: SELECT … (in a long txn) → holds ACCESS SHARE on accounts
Session B: ALTER TABLE accounts … → ⏳ waits — ACCESS EXCLUSIVE conflicts with A
Session C: SELECT … (a plain read) → ⏳ blocked behind B's queued ACCESS EXCLUSIVE
Session A: COMMIT → B's ALTER runs, then C's read drains
```

<!--@include: ./parts/alter-table-outage.md-->

The cruel part: the `ALTER` itself is instant. What kills you is a *waiting* `ALTER`, because
every later query — reads included — must queue behind its `ACCESS EXCLUSIVE` request. One
forgotten `BEGIN` in a console session plus one routine migration equals a full table outage.

::: warning Never run DDL without `lock_timeout`
A migration that fails fast and retries is a non-event; a migration that queues is an outage.
:::

## The fix: lock_timeout + retry

<!--@include: ./parts/ddl-lock-timeout.md-->

Set `lock_timeout` once in your migration tool, per session rather than in `postgresql.conf` —
the manual [advises against setting it globally](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT)
because it would trip every session, not only your migrations. A migration that can't get its
lock now fails fast and retries instead of parking a `ACCESS EXCLUSIVE` request at the head of
the queue.

That leaves one number to respect: the blast radius. It's the longest transaction currently
touching the table multiplied by all the traffic on that table, which is why long-running
transactions and migrations are natural enemies. It also helps to know that not every
`ALTER TABLE` is equally dangerous — the
[manual lists the lock each form takes](https://www.postgresql.org/docs/current/sql-altertable.html),
and some are gentle. `SET STATISTICS` needs only `SHARE UPDATE EXCLUSIVE`, which blocks neither
reads nor writes. A plain `CREATE INDEX`
[locks out writes but not reads](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY);
`CREATE INDEX CONCURRENTLY` exists to avoid even that. When you do want to watch a pile-up form
live, the wait-chain query from the transcript is unpacked in the next lesson on
[monitoring locks](/postgres/03-locking/monitoring-locks).

## Further reading

- [PostgreSQL docs: Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES) —
  all eight modes and their conflict table
- [PostgreSQL docs: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [The same lesson on MySQL](/mysql/03-locking/table-locks-and-ddl)
