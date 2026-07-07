# Table locks & DDL

Row locks aren't the only game. Every statement that touches a table also holds a **metadata
lock (MDL)** on it for the whole transaction, and DDL needs that lock *exclusively*. This is
how a one-millisecond `ALTER TABLE` takes a production system down.

## The classic migration outage

Even an `ALGORITHM=INSTANT` column add must wait for every open transaction that has touched
the table. While it waits, its exclusive request blocks **everyone who comes after it** —
including plain SELECTs:

<!--@include: ./parts/alter-table-outage.md-->

## The fix: run DDL with a lock_wait_timeout

MDL waits are governed by `lock_wait_timeout` (a *different* variable from InnoDB's
`innodb_lock_wait_timeout`, default: one year). Set it low for migrations so they fail fast
instead of camping in the queue:

<!--@include: ./parts/ddl-lock-timeout.md-->

## Key takeaways

- Any open transaction that merely *read* a table holds a shared MDL on it until it ends —
  long-running transactions and migrations are natural enemies.
- A **waiting** exclusive MDL request blocks all later queries on the table: the outage is
  caused by the queue, not the DDL itself.
- Diagnose with `performance_schema.processlist` — the stuck sessions all show
  `Waiting for table metadata lock`.
- Two differences from [PostgreSQL](/postgres/03-locking/table-locks-and-ddl): MySQL DDL
  **commits your open transaction implicitly** and cannot be rolled back; and the timeout
  knob is `lock_wait_timeout` (seconds), not `lock_timeout` (ms).

## Further reading

- [MySQL docs: Metadata Locking](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html)
- [MySQL docs: lock_wait_timeout](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_lock_wait_timeout)
