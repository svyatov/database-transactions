# Pitfalls compendium

Every transaction bug this site can prove on MySQL, in one place — keyed by what you'd
actually observe. Each entry links to the scenario that reproduces it and the lesson that
fixes it. If you're staring at a live incident, start with the
[symptom triage table](/mysql/08-production/symptom-triage) instead.

**Jump to your symptom:**

1. [Increments vanish under load](#_1-increments-vanish-under-load)
2. [Duplicates despite an "is it taken?" check](#_2-duplicates-despite-an-is-it-taken-check)
3. [A customer is charged twice](#_3-a-customer-is-charged-twice)
4. [An invariant across rows breaks with no error](#_4-an-invariant-across-rows-breaks-with-no-error)
5. [Your report's numbers are self-contradictory](#_5-your-report-s-numbers-are-self-contradictory)
6. [After a timeout, "retrying" corrupted the transaction](#_6-after-a-timeout-retrying-corrupted-the-transaction)
7. [A "transactional" migration left half its work behind](#_7-a-transactional-migration-left-half-its-work-behind)
8. [INSERTs block with no duplicate in sight](#_8-inserts-block-with-no-duplicate-in-sight)
9. [Deadlocks between transactions that "never touch the same row"](#_9-deadlocks-between-transactions-that-never-touch-the-same-row)
10. [A "trivial" migration takes the site down](#_10-a-trivial-migration-takes-the-site-down)
11. [The connection pool is empty, but the database is idle](#_11-the-connection-pool-is-empty-but-the-database-is-idle)
12. [Disk keeps growing though no table grew](#_12-disk-keeps-growing-though-no-table-grew)
13. [Events lost (or invented) between the database and the broker](#_13-events-lost-or-invented-between-the-database-and-the-broker)
14. [Locks are held, and no session owns them](#_14-locks-are-held-and-no-session-owns-them)
15. [A deadlock — and both transactions looked innocent](#_15-a-deadlock-—-and-both-transactions-looked-innocent)

## 1. Increments vanish under load

**Broken:** read a value, compute in application code, write it back — concurrent writers
silently overwrite each other, and *no MySQL level below SERIALIZABLE objects*, including
the REPEATABLE READ default.
**Fix:** atomic `SET x = x + …`, `SELECT … FOR UPDATE`, or a version column.
**Proof:** [the lost update](/mysql/02-isolation/lost-update) ·
[all three fixes](/mysql/05-patterns/fixing-lost-updates)

## 2. Duplicates despite an "is it taken?" check

**Broken:** `SELECT` then `INSERT` — both transactions honestly saw no row.
**Fix:** a `UNIQUE` constraint, with `ON DUPLICATE KEY UPDATE` for control flow.
**Proof:** [check-then-insert](/mysql/05-patterns/check-then-insert)

## 3. A customer is charged twice

**Broken:** the client retried; the operation ran twice, each run individually correct.
**Fix:** an idempotency key — gate and work in one transaction, verdict by affected rows.
**Proof:** [idempotency keys](/mysql/05-patterns/idempotency)

## 4. An invariant across rows breaks with no error

**Broken:** "at least one doctor on call" checked per-transaction; two transactions
update *different* rows — write skew, invisible below SERIALIZABLE.
**Fix:** SERIALIZABLE (locking, plus `1213` retries), or serialize explicitly with
`FOR UPDATE`.
**Proof:** [write skew](/mysql/02-isolation/serializable)

## 5. Your report's numbers are self-contradictory

**Broken:** a REPEATABLE READ transaction mixes plain SELECTs (frozen snapshot) with
UPDATE/DELETE results (current data) — the write acts on rows the reads never showed.
**Fix:** locking reads (`FOR UPDATE`/`FOR SHARE`) when you intend to write what you read.
**Proof:** [current reads](/mysql/02-isolation/repeatable-read) ·
[the DELETE that removes nothing](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds)

## 6. After a timeout, "retrying" corrupted the transaction

**Broken:** errno `1205` rolls back only the **statement**; code that treats it like a
deadlock and re-runs the whole function double-applies everything before the timeout.
**Fix:** on `1205`: ROLLBACK, *then* retry the transaction. Only `1213` self-rolls-back.
**Proof:** [lock timeouts](/mysql/03-locking/nowait-skip-locked) ·
[deadlocks](/mysql/03-locking/deadlocks)

## 7. A "transactional" migration left half its work behind

**Broken:** DDL implicitly commits the open transaction — a failed migration script
"rolls back" nothing; the data changes before the DDL are already permanent.
**Fix:** re-runnable migrations; one DDL per migration; never mix data + schema in one
"transaction".
**Proof:** [implicit commit](/mysql/05-patterns/orm-pitfalls)

## 8. INSERTs block with no duplicate in sight

**Broken:** a REPEATABLE READ locking read on a range gap-locked the space where the new
row belongs; the INSERT waits for a transaction that never touched any existing row it
conflicts with.
**Fix:** narrower locking reads; READ COMMITTED for range-scanning writers.
**Proof:** [gap locks](/mysql/03-locking/gap-locks)

## 9. Deadlocks between transactions that "never touch the same row"

**Broken:** two range-scanning transactions gap-lock the same interval (gap locks don't
conflict with each other), then both INSERT into it — each waits on the other's gap.
**Fix:** consistent ordering, smaller ranges, `1213` retries everywhere.
**Proof:** [gap locks](/mysql/03-locking/gap-locks) ·
[deadlocks](/mysql/03-locking/deadlocks) · [the retry loop](/mysql/05-patterns/retrying-deadlocks)

## 10. A "trivial" migration takes the site down

**Broken:** `ALTER TABLE` queued behind one long transaction's metadata lock; every later
query queued behind the `ALTER` — the queue, not the DDL, is the outage.
**Fix:** `lock_wait_timeout` on the DDL session; find and end long transactions first.
**Proof:** [table locks & DDL](/mysql/03-locking/table-locks-and-ddl)

## 11. The connection pool is empty, but the database is idle

**Broken:** sessions parked with open transactions — an ORM or a stray `await` between
BEGIN and COMMIT — each holding locks and a pooled connection, with no server-side
timeout to reap them.
**Fix:** fix the code (no I/O in transactions); monitor and kill.
**Proof:** [ORM pitfalls](/mysql/05-patterns/orm-pitfalls) ·
[find & kill them](/mysql/08-production/long-and-idle-transactions)

## 12. Disk keeps growing though no table grew

**Broken:** one forgotten read-only transaction pins the undo history of every commit
since it started — purge is forbidden, not slow.
**Fix:** end the transaction; alert on history list length and oldest-transaction age.
**Proof:** [the history list](/mysql/04-mvcc/history-list-length) ·
[history list health](/mysql/08-production/history-list-health)

## 13. Events lost (or invented) between the database and the broker

**Broken:** two systems, two writes, no shared transaction — a crash between them leaves
the two permanently disagreeing.
**Fix:** the transactional outbox; consumers idempotent (delivery is at-least-once).
**Proof:** [the dual-write problem](/mysql/06-distributed/transactional-outbox)

## 14. Locks are held, and no session owns them

**Broken:** a prepared XA transaction survived its session's death; it holds row locks
until someone finishes it by name — nothing expires it.
**Fix:** `XA RECOVER`, then `XA COMMIT`/`XA ROLLBACK` by gid; don't run XA without a
transaction manager that owns recovery.
**Proof:** [XA transactions](/mysql/06-distributed/xa-transactions)

## 15. A deadlock — and both transactions looked innocent

**Broken:** two transactions locked the same rows in opposite orders; InnoDB rolled one
back (`1213`) so the other could finish.
**Fix:** consistent lock ordering (sort your ids!), short transactions, retries.
**Proof:** [deadlocks](/mysql/03-locking/deadlocks) ·
[deadlock avoidance](/mysql/03-locking/deadlocks) ·
[count them in production](/mysql/08-production/logs-and-counters)
