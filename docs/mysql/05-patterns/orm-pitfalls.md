# ORM pitfalls

Inspect the SQL and transaction boundaries your ORM actually uses. This lesson executes SQL on MySQL 8.4 InnoDB, not a framework or migration library. It does not establish how every ORM configures transactions, locking, or retries.

## Pitfall #1: DDL in a "transaction" is the migration lie

A transaction wrapper cannot make the demonstrated INSERT plus CREATE INDEX atomic. The [implicit-commit manual](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) lists statements that end an active transaction "as if you had done a `COMMIT` before executing the statement." CREATE INDEX is on that list.

<!--@include: ./parts/implicit-commit.md-->

B sees the inserted order after CREATE INDEX and still sees it after A's ROLLBACK. The scenario executes a successful CREATE INDEX followed by explicit rollback; it does not inject a migration exception. Design recovery around these commit boundaries and make completed steps safe to inspect and resume.

The same [manual section](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) documents exceptions: CREATE TEMPORARY TABLE and DROP TEMPORARY TABLE do not implicitly commit, but their effects cannot be rolled back. Check the actual statement; "every DDL commits" is too broad. Atomic execution of a supported DDL statement is also distinct from rolling back a user transaction containing DDL and data changes.

## Pitfall #2: the transaction that outlives the query

Waiting for an API or rendering inside an open transaction can extend the lifetime of locks and read views already held. The relevant database behaviors are demonstrated in [row locks](/mysql/03-locking/row-locks), [metadata-lock waits](/mysql/03-locking/table-locks-and-ddl), and [retained undo history](/mysql/04-mvcc/history-list-length). Not every transaction holds all three. Keep the protected database work short; moving a remote effect outside it still requires an explicit [failure-boundary design](/mysql/06-distributed/transactional-outbox).

## Pitfall #3: no transaction where you assumed one

If a load and save use separate transactions, or a plain read is followed by a stale absolute write, the SQL can reproduce the [lost-update schedule](/mysql/02-isolation/lost-update). Check whether your ORM exposes arithmetic updates, a locking read in the same transaction, or a version predicate. The [three repair schedules](/mysql/05-patterns/fixing-lost-updates) demonstrate those SQL protocols; their presence in an ORM must be checked separately.

## Pitfall #4: trusting default isolation

The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) states: "The default isolation level for `InnoDB` is `REPEATABLE READ`." A configured server, connection, or ORM can change it. The [REPEATABLE READ lesson](/mysql/02-isolation/repeatable-read) separates snapshot reads from locking reads and writes. That level does not reject the demonstrated stale overwrite. [SERIALIZABLE](/mysql/02-isolation/serializable) uses more locking and can produce a deadlock; it does not remove the need to handle errors and retry complete transactions where appropriate. Verify the ORM's recovery behavior rather than assuming it reruns business logic.

## Further reading

- [MySQL docs: Statements That Cause an Implicit Commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/orm-pitfalls)
