# Table locks & DDL

MySQL 8.4 metadata locks (MDL) protect object definitions. They differ from InnoDB record
and intention locks and explicit MySQL `LOCK TABLES` locks. The
[metadata-locking manual](https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html)
documents acquisition and release: a table used by an explicit transaction retains its
metadata lock until the transaction ends; under autocommit that transaction can be one statement.

::: warning ALTER TABLE commits your open transaction
`ALTER TABLE` implicitly commits pending work before execution. Its schema change is not
undone by an application ROLLBACK. Do not generalize this to every DDL form:
`CREATE TEMPORARY TABLE` and `DROP TEMPORARY TABLE` are exceptions to implicit commit,
but their effects still cannot be rolled back. See the
[implicit-commit manual](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
and [ORM pitfalls](/mysql/05-patterns/orm-pitfalls).
:::

## The classic migration outage

A's explicit read transaction holds MDL. B's column addition waits for an exclusive
metadata lock, and the later SELECT from C waits too. The transcript asserts both process
states and their completion after A commits. It does not specify `ALGORITHM=INSTANT` or
measure DDL runtime. Metadata-lock priority rules, including `max_write_lock_count`, are
Documented contracts, not a universal FIFO rule established here.

<!--@include: ./parts/alter-table-outage.md-->

## The fix: run DDL with a lock_wait_timeout

The [variable manual](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_lock_wait_timeout)
documents a metadata-lock timeout in whole seconds, defaulting to 31536000 (one year).
It applies separately to each lock acquisition attempt, not to total statement runtime.

<!--@include: ./parts/ddl-lock-timeout.md-->

B still queues while waiting. The scenario proves that after its one-second timeout
(`1205`), C reads successfully while A remains open; it does not prove C could never be
blocked during that second. A later retry succeeds after A commits.
Use a timeout to limit migration waits, not as a promise of no outage.
Inspect `performance_schema.metadata_locks` and process states via
[monitoring locks](/mysql/03-locking/monitoring-locks).

## Further reading

- [The PostgreSQL counterpart](/postgres/03-locking/table-locks-and-ddl)
