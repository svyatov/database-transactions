---
description: "Transaction boundaries and ACID, with scoped table-write demonstrations and separate documented durability and error-recovery contracts."
---

# What is a transaction?

A transaction groups transactional database work that commits together or is discarded by rollback. The two-account transfer demonstrations assert the original balances after rollback on [PostgreSQL](/postgres/01-basics/what-is-a-transaction) and [MySQL InnoDB](/mysql/01-basics/what-is-a-transaction). This boundary excludes external effects, PostgreSQL sequence counters, nontransactional MySQL tables, and operations that cause implicit commits.

## ACID

| Property | Scoped meaning | Support |
|---|---|---|
| **Atomicity** | Transactional table changes share commit/rollback | The two linked transfer Scenarios assert explicit rollback, not every failure |
| **Consistency** | Declared constraints and correct serial transaction logic preserve their stated rules | CHECK failures are demonstrated; arbitrary application rules are not automatic |
| **Isolation** | Concurrent operations follow the engine's selected isolation contract | [Levels](/concepts/isolation-levels), assertions, manual contracts, and marked derivations |
| **Durability** | Acknowledged persistence depends on durability settings and storage behavior | Documented support below; no server-crash experiment here |

Atomicity does not mean all statements succeed or every reader sees the same values. A failed InnoDB statement can leave earlier work to be committed unless the transaction is rolled back. READ UNCOMMITTED can expose uncommitted changes. Isolation and error handling therefore need their own conditions.

A business invariant requires each serial transaction to preserve it and all relevant writers to use an appropriate protocol. A CHECK on one balance does not enforce an arbitrary cross-row rule or an external payment boundary.

Durability is a documented contract, not a claimed crash test. The [PostgreSQL 18 asynchronous-commit manual](https://www.postgresql.org/docs/18/wal-async-commit.html) warns that "the most recent transactions may be lost if the database should crash." [MySQL 8.4's ACID manual](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html) likewise identifies server settings, operating system, and hardware as durability conditions. A successful COMMIT in these demonstrations does not test crash recovery, storage reliability, or every configuration.

## Same promise, different temperament

- **PostgreSQL**: an ordinary statement error inside BEGIN leaves a failed transaction block. Ordinary statements fail until full rollback or recovery to a valid savepoint. A standalone failed statement ends its implicit transaction. See [error-state assertions](/postgres/01-basics/begin-commit-rollback) and [savepoint recovery](/postgres/01-basics/savepoints). Connection loss is a separate case.
- **MySQL InnoDB**: the demonstrated CHECK/duplicate-key errors roll back the statement, retaining earlier work until explicit rollback or commit. Deadlocks roll back the transaction; row-lock timeout rollback depends on innodb_rollback_on_timeout. The [8.4 error manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html) states for a deadlock: "Retry the entire transaction when this happens." See [the basic error schedule](/mysql/01-basics/begin-commit-rollback) and [timeout scope](/errors/1205).

Complete-operation retries need fresh reads and decisions, a bound, and a separate policy for effects outside the database transaction. Neither engine promises every retry succeeds.

## See it happen

- [PostgreSQL transfer](/postgres/01-basics/what-is-a-transaction): CHECK failure and full rollback, with another session excluding the uncommitted credit at READ COMMITTED.
- [MySQL transfer](/mysql/01-basics/what-is-a-transaction): the failed debit leaves the earlier credit visible to its own transaction until explicit rollback.
