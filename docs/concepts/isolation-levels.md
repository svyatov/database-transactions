---
description: "The four standard isolation names, scoped PostgreSQL 18 and MySQL 8.4 consistent/current operations, and the limits of demonstrated schedules."
---

# Isolation levels

Isolation specifies how concurrent operations interact. SERIALIZABLE committed participating transactions have an effect equivalent to some serial ordering; it does not automatically repair incorrect serial business logic. Performance depends on the workload and implementation, and is not measured by this site's schedules.

## The SQL standard's four levels

The [PostgreSQL 18 manual's standard comparison](https://www.postgresql.org/docs/18/transaction-iso.html#MVCC-ISOLEVEL-TABLE) documents these minimum restrictions. The table names permitted phenomena, not a claim that every run produces them.

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | permitted | permitted | permitted |
| READ COMMITTED | excluded | permitted | permitted |
| REPEATABLE READ | excluded | excluded | permitted |
| SERIALIZABLE | excluded | excluded | excluded |

The standard's SERIALIZABLE definition also excludes serialization anomalies. Its classic three-column table alone does not characterize every [lost-update](/concepts/lost-update), [write-skew](/concepts/write-skew), or [read-only](/concepts/isolation-anomalies#the-read-only-anomaly) schedule. The [engine catalogs](/concepts/anomalies-by-engine) distinguish asserted examples from wider contracts.

## Snapshots and operations {#how-mvcc-engines-implement-the-ladder-snapshots}

PostgreSQL stores tuple versions; InnoDB reconstructs older records using undo. This is not one identical storage algorithm. MVCC consistent reads can avoid conflicting row-write locks, but table/metadata locks, locking reads, and SERIALIZABLE InnoDB reads have separate rules.

| Operation | PostgreSQL 18 | MySQL 8.4 InnoDB |
|---|---|---|
| Default level | READ COMMITTED | REPEATABLE READ |
| READ UNCOMMITTED | M: maps to READ COMMITTED; D: [dirty value excluded](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | D: [dirty value read then rolled back](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) |
| READ COMMITTED plain consistent SELECT | Statement snapshot plus own prior writes | Statement snapshot plus own prior writes |
| REPEATABLE READ plain consistent SELECT | First non-transaction-control statement establishes snapshot; own writes remain visible | First consistent read establishes snapshot; own writes remain visible |
| Updating/locking commands | RC target rechecks and RR changed-target conflicts are [separate rules](/postgres/02-isolation/repeatable-read) | Current reads differ from the consistent snapshot, [demonstrated here](/mysql/02-isolation/repeatable-read) |
| SERIALIZABLE | SSI adds dependency checks; ordinary write locks and errors still exist | With autocommit disabled or inside BEGIN, plain SELECTs acquire shared locks; standalone autocommit reads are an exception |

These are Documented contracts under the named operations, illustrated by linked Scenarios. PostgreSQL's [18 isolation manual](https://www.postgresql.org/docs/18/transaction-iso.html) says: "each query does see the effects of previous updates executed within its own transaction". For READ COMMITTED plain SELECT, it also says "sees only data committed before the query began". InnoDB's [8.4 isolation manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) says for SERIALIZABLE: "InnoDB implicitly converts all plain SELECT statements to SELECT ... FOR SHARE" when autocommit is disabled. Its [consistent-read manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html) specifies "no changes made by later or uncommitted transactions" and the "snapshot established by the first such read in that transaction", with the own-write exception and different current-DML rules. Neither contract makes every statement or every SQL function a stable snapshot read.

## Same names, different contracts

The [lost-update Scenarios](/concepts/lost-update) read and write inside their shown transactions. PostgreSQL REPEATABLE READ rejects a post-snapshot changed target with 40001; InnoDB REPEATABLE READ permits the demonstrated stale literal write. Values read outside the protected transaction need separate protection. SERIALIZABLE conflicts can wait or fail, and a retry requires fresh decisions rather than only resending a write.

## Go deeper

- [PostgreSQL snapshots and levels](/postgres/02-isolation/snapshots-and-the-four-levels)
- [MySQL snapshots and levels](/mysql/02-isolation/snapshots-and-the-four-levels)
- [The complete reference comparison](/concepts/anomalies-by-engine)
