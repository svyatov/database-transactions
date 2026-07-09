# Table locks & DDL

Row locks aren't the only game. Every statement that touches a table also holds a *metadata
lock* (MDL) on it for the whole transaction, and DDL needs that lock in exclusive mode. That's
how a one-millisecond `ALTER TABLE` takes a production system down.

::: warning DDL commits your open transaction
Every DDL statement on MySQL commits implicitly — whatever your transaction had done so far
is committed, and the DDL itself cannot be rolled back. A "transactional" migration that
mixes DML and DDL is not transactional — see [ORM pitfalls](/mysql/05-patterns/orm-pitfalls).
:::

## The classic migration outage

Even an `ALGORITHM=INSTANT` column add must wait for every open transaction that has touched
the table. While it waits, its exclusive request sits at the head of the queue, and every
query that arrives after it — plain SELECTs included — has to wait behind it:

<!--@include: ./parts/alter-table-outage.md-->

## The fix: run DDL with a lock_wait_timeout

MDL waits are governed by `lock_wait_timeout` (a *different* variable from InnoDB's
`innodb_lock_wait_timeout`, default: one year). Set it low for migrations so they fail fast
instead of camping in the queue:

<!--@include: ./parts/ddl-lock-timeout.md-->

The through-line is that a shared MDL outlives every statement that took it, right up to
`COMMIT`, so a long-running read and a migration are natural enemies. The outage isn't the DDL
doing work — an `INSTANT` add does almost none — it's the queue that forms behind the DDL's
waiting exclusive request, which you can watch from `performance_schema.processlist` where
every stuck session reports `Waiting for table metadata lock`. The lever that saves you is
`lock_wait_timeout`, measured in whole seconds, a different knob from
[PostgreSQL's millisecond `lock_timeout`](/postgres/03-locking/table-locks-and-ddl). The other
way a write gets stuck isn't a queue but a cycle — two transactions each holding what the
other needs, which is where [deadlocks](/mysql/03-locking/deadlocks) come in.

## Further reading

- [MySQL docs: Metadata Locking](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html)
- [MySQL docs: lock_wait_timeout](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_lock_wait_timeout)
- [The same lesson on PostgreSQL](/postgres/03-locking/table-locks-and-ddl)
