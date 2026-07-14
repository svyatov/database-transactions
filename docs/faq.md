---
title: "Frequently asked questions"
description: "Straight answers to the questions people actually type about database transactions (dirty reads, lost updates, isolation levels, deadlocks), each one linked to a runnable proof."
---

# Frequently asked questions

The short answers people search for, each backed by a transcript a real database produced (or the concept page that owns the idea). If a question sends you deeper, follow its link. That's where the proof lives.

## Does PostgreSQL have dirty reads?

No. PostgreSQL never shows you another transaction's uncommitted changes, even when you explicitly ask for `READ UNCOMMITTED`. It silently treats that level as `READ COMMITTED`. See it refuse to serve a dirty read in [Read Committed](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them).

## Does MySQL have dirty reads?

Only if you go out of your way to ask for them. MySQL's default is `REPEATABLE READ`, which never shows uncommitted data; drop to `READ UNCOMMITTED` and it will hand you a value that may vanish on the writer's rollback, as shown in [Snapshots and the four levels](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it).

## Is REPEATABLE READ the same as SERIALIZABLE?

No. `REPEATABLE READ` freezes the rows you've already read but still permits anomalies a fully serial schedule would forbid (most famously write skew), while `SERIALIZABLE` forbids anything no serial order could produce. The distinction, and why the names promise less than they sound like, lives in [Isolation levels](/concepts/isolation-levels).

## Why did my UPDATE get lost?

Two transactions read the same row, each computed a new value from what it read, and the second write overwrote the first: the classic lost update. Watch a deposit vanish that way in [Lost updates](/postgres/02-isolation/lost-update#watch-a-deposit-disappear).

## How do I stop concurrent updates from clobbering each other?

Don't read-then-write in the application; either compute the new value in a single SQL statement, lock the row with `SELECT ... FOR UPDATE`, or use a version column and retry on conflict. All three fixes are worked through in [Fixing lost updates](/postgres/05-patterns/fixing-lost-updates).

## What happens to my transaction after an error in the middle of it?

In PostgreSQL, one failed statement poisons the entire transaction: every later command returns `25P02` until you `ROLLBACK`, so a stray error can't leave you half-committed. See it happen in [BEGIN, COMMIT, ROLLBACK](/postgres/01-basics/begin-commit-rollback#one-error-poisons-the-whole-transaction).

## Does a plain SELECT block other writers?

No. A bare `SELECT` takes no row locks, so writers run right past it. That's the point of MVCC. Add `FOR UPDATE` and it does block writers (and only writers), which is exactly when you want it to. The boundary is drawn in [Row locks](/postgres/03-locking/row-locks#for-update-blocks-writers-and-only-writers).

## What is a deadlock, and which transaction gets killed?

Two transactions each hold a lock the other needs, so neither can proceed; the database detects the cycle and kills one of them with a deadlock error, leaving the other to finish. Watch two opposite-direction transfers deadlock in [Deadlocks](/postgres/03-locking/deadlocks#two-transfers-opposite-directions).

## Can two transactions both commit successfully and still corrupt the data?

Yes. That's write skew. Each transaction reads, sees a rule still satisfied, and writes; individually both are fine, but together they break an invariant no serial order would have allowed. `SERIALIZABLE` is what stops it, demonstrated in [Serializable](/mysql/02-isolation/serializable#write-skew-at-repeatable-read).

## Why did I get "could not serialize access" (40001)?

Your `REPEATABLE READ` or `SERIALIZABLE` transaction tried to update a row that another transaction changed and committed after your snapshot began. PostgreSQL refuses the write rather than lose an update, and the fix is to retry the whole transaction. The full explanation is on the [40001 error page](/errors/40001).

## Does REPEATABLE READ prevent phantom reads in PostgreSQL?

Yes, unlike the SQL standard, which permits phantoms at that level. PostgreSQL's `REPEATABLE READ` runs every statement against one snapshot, so a range query returns the same rows however many times you run it, as proven in [Repeatable Read](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms).

## How should I recover from a serialization failure?

Retry the whole transaction, not just the statement that failed. The conflict is against your transaction's snapshot, so a fresh statement in the same transaction fails the same way. The retry loop, and where to put it, is in [Retrying serialization failures](/postgres/05-patterns/retrying-serialization-failures#retry-the-transaction-not-the-statement).
