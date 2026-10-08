---
title: "Frequently asked questions"
description: "Scoped answers about PostgreSQL and MySQL transaction behavior, with asserted schedules, manual contracts, and marked derivations."
---

# Frequently asked questions

These answers concern PostgreSQL 18 and MySQL 8.4 InnoDB transactional tables unless stated otherwise. Follow the evidence links for the exact schedule, documented contract, or marked derivation. A Transcript is not proof of all executions.

## Does PostgreSQL have dirty reads?

Plain SELECTs do not read another transaction's uncommitted table changes. PostgreSQL maps `READ UNCOMMITTED` to `READ COMMITTED`; own writes and nontransactional sequence state have separate rules. See the assertion and manual support in [Read Committed](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them).

## Does MySQL have dirty reads?

InnoDB plain consistent SELECTs at its default `REPEATABLE READ` exclude other transactions' uncommitted changes. `READ UNCOMMITTED` permits dirty reads. Own writes remain visible. See the asserted dirty read in [Snapshots and the four levels](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it).

## Is REPEATABLE READ the same as SERIALIZABLE?

No. `REPEATABLE READ` excludes later concurrent commits from snapshot reads, but permits demonstrated write skew; own writes and InnoDB current reads require separate scope. `SERIALIZABLE` protects committed participating transactions' serial equivalence. A rule must also hold when each transaction runs serially. See [Isolation levels](/concepts/isolation-levels).

## Why did my UPDATE get lost?

Two transactions read the same row, each computed a new value from what it read, and the second write overwrote the first: the classic lost update. Watch a deposit vanish that way in [Lost updates](/postgres/02-isolation/lost-update#watch-a-deposit-disappear).

## How do I stop concurrent updates from clobbering each other?

For the demonstrated single-row deposits, use SQL arithmetic, a locking read and write in one transaction, or a checked version predicate with conflict handling. All relevant writers must use the protocol. A stale human edit may need reconsideration rather than automatic retry; cross-row rules and external effects need separate protection. See [PostgreSQL](/postgres/05-patterns/fixing-lost-updates) and [MySQL](/mysql/05-patterns/fixing-lost-updates).

## What happens to my transaction after an error in the middle of it?

A PostgreSQL statement error inside `BEGIN` leaves a failed block: ordinary statements return `25P02` until full rollback or recovery to a valid savepoint. A standalone failed statement ends its implicit transaction. InnoDB's duplicate-key error normally rolls back the statement, but a deadlock rolls back the transaction; row-lock timeout scope depends on configuration. Connection loss is another boundary. See [PostgreSQL recovery](/postgres/01-basics/begin-commit-rollback#one-error-poisons-the-whole-transaction), [savepoints](/postgres/01-basics/savepoints), and [MySQL error scope](/mysql/01-basics/begin-commit-rollback).

## Does a plain SELECT block other writers?

A PostgreSQL ordinary SELECT or InnoDB consistent SELECT avoids conflicting row-write locks. Table/metadata locks can still cause waits. InnoDB SERIALIZABLE plain reads in an explicit transaction use shared locks; locking reads can conflict with other locking reads as well as writers. See [PostgreSQL row/table scope](/postgres/03-locking/row-locks#an-ordinary-select-succeeds-while-update-waits) and [MySQL SERIALIZABLE scope](/mysql/02-isolation/serializable).

## What is a deadlock, and which transaction gets killed?

A cycle of lock dependencies prevents progress. Detection rejects an attempt, not necessarily the connection, and victim selection is not universal. InnoDB detection can be disabled. The shown two-row schedule observes one survivor; retry is bounded and can fail. See [PostgreSQL](/postgres/03-locking/deadlocks#two-transfers-opposite-directions) and [MySQL](/mysql/03-locking/deadlocks).

## Can two transactions both commit successfully and still corrupt the data?

Yes. The on-call write-skew schedule lets two transactions each check a rule and then jointly break it. SERIALIZABLE participating transactions or suitable shared coordination can protect it, provided each serial transaction preserves the rule. See the [MySQL demonstration](/mysql/02-isolation/serializable#write-skew-at-repeatable-read).

## Why did I get "could not serialize access" (40001)?

One PostgreSQL cause is an updating or locking command finding a target changed and committed since its REPEATABLE READ snapshot. SERIALIZABLE dependency conflicts can also raise `40001`. Roll back and repeat the complete transaction with fresh reads/decisions, or return controlled failure; retries can fail and external effects can repeat. MySQL errno `1213` also has SQLSTATE `40001`. See the [40001 error page](/errors/40001).

## Does REPEATABLE READ prevent phantom reads in PostgreSQL?

Yes for plain SELECTs over transactional tables in one transaction, excluding later concurrent commits. The snapshot starts at the first non-transaction-control statement, and own writes remain visible. Updating/locking commands and sequences have separate rules. See the assertions and manual support in [Repeatable Read](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms).

## How should I recover from a serialization failure?

Roll back the failed attempt and repeat all reads and decisions in a fresh transaction, with bounded retries or controlled failure. Retrying only the failed statement does not reconsider the earlier decisions. This protects no separately committed external effect. See [Retrying serialization failures](/postgres/05-patterns/retrying-serialization-failures#retry-the-transaction-not-the-statement).
