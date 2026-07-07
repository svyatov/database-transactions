# Table locks & DDL

Row locks are what you fight over in application code. **Table locks** are what take your site
down during a deploy. Every statement — even a plain `SELECT` — locks every table it touches;
the modes just usually don't conflict. Until a migration shows up:

- `SELECT` takes `ACCESS SHARE`, the weakest table lock;
- `DROP TABLE`, `TRUNCATE`, and most forms of `ALTER TABLE` take **`ACCESS EXCLUSIVE`** — the
  manual's rule for ALTER TABLE is
  ["an ACCESS EXCLUSIVE lock is acquired unless explicitly noted"](https://www.postgresql.org/docs/current/sql-altertable.html) —
  and `ACCESS EXCLUSIVE`
  [conflicts with *all* modes](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES),
  including `ACCESS SHARE`.

On its own that's fine: the ALTER waits for running queries to finish, then does its
(often fast) work. The disaster needs one more ingredient — the [lock queue](/postgres/03-locking/lock-queues).

## The outage, reproduced

<!--@include: ./parts/alter-table-outage.md-->

The cruel part: the `ALTER` itself is instant. What kills you is a *waiting* `ALTER`, because
every later query — reads included — must queue behind its `ACCESS EXCLUSIVE` request. One
forgotten `BEGIN` in a console session plus one routine migration equals a full table outage.

::: warning Never run DDL without `lock_timeout`
A migration that fails fast and retries is a non-event; a migration that queues is an outage.
:::

## The fix: lock_timeout + retry

<!--@include: ./parts/ddl-lock-timeout.md-->

## Key takeaways

- Configure `lock_timeout` once in your migration tool — per session, not in
  `postgresql.conf` (the manual
  [advises against setting it globally](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT)).
- The blast radius of DDL = (longest transaction currently touching the table) × (all traffic
  on that table). Long-running transactions and migrations are natural enemies.
- Not all `ALTER TABLE` forms are equal — the
  [manual lists the lock each one takes](https://www.postgresql.org/docs/current/sql-altertable.html);
  some take weaker locks (`SET STATISTICS` needs only `SHARE UPDATE EXCLUSIVE`, which doesn't
  block reads or writes). Plain `CREATE INDEX`
  [locks out writes but not reads](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY);
  `CREATE INDEX CONCURRENTLY` exists precisely to avoid that.
- Watching it live: the wait-chain query from the transcript is unpacked in
  [monitoring locks](/postgres/03-locking/monitoring-locks).

## Further reading

- [PostgreSQL docs: Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES) —
  all eight modes and their conflict table
- [PostgreSQL docs: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [The same lesson on MySQL](/mysql/03-locking/table-locks-and-ddl)
