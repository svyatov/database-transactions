# Pitfalls compendium

Every transaction bug this site can prove, in one place — keyed by what you'd actually
observe. Each entry links to the scenario that reproduces it and the lesson that fixes
it. If you're staring at a live incident, start with the
[symptom triage table](/postgres/08-production/symptom-triage) instead.

**Jump to your symptom:**

1. [Increments vanish under load](#_1-increments-vanish-under-load)
2. [Duplicates despite an "is it taken?" check](#_2-duplicates-despite-an-is-it-taken-check)
3. [A customer is charged twice](#_3-a-customer-is-charged-twice)
4. [An invariant across rows breaks with no error](#_4-an-invariant-across-rows-breaks-with-no-error)
5. [A "trivial" migration takes the site down](#_5-a-trivial-migration-takes-the-site-down)
6. [The connection pool is empty, but the database is idle](#_6-the-connection-pool-is-empty-but-the-database-is-idle)
7. [A table keeps growing though rows are deleted](#_7-a-table-keeps-growing-though-rows-are-deleted)
8. [Random `40001` errors under load](#_8-random-40001-errors-under-load)
9. [Two workers process the same job](#_9-two-workers-process-the-same-job)
10. [Events reach the broker for data that doesn't exist (or never reach it)](#_10-events-reach-the-broker-for-data-that-doesn-t-exist-or-never-reach-it)
11. [Locks are held, VACUUM is stuck — and no session owns any of it](#_11-locks-are-held-vacuum-is-stuck-—-and-no-session-owns-any-of-it)
12. [A deadlock — and both transactions looked innocent](#_12-a-deadlock-—-and-both-transactions-looked-innocent)
13. [A job queue balloons on disk while autovacuum runs clean](#_13-a-job-queue-balloons-on-disk-while-autovacuum-runs-clean)

## 1. Increments vanish under load

**Broken:** read a value, compute in application code, write it back — at the default
READ COMMITTED, concurrent writers silently overwrite each other.
**Fix:** atomic `SET x = x + …`, `SELECT … FOR UPDATE`, or a version column.
**Proof:** [the lost update](/postgres/02-isolation/lost-update) ·
[all three fixes](/postgres/05-patterns/fixing-lost-updates)

## 2. Duplicates despite an "is it taken?" check

**Broken:** `SELECT` then `INSERT` — both transactions honestly saw no row.
**Fix:** a `UNIQUE` constraint, with `ON CONFLICT` for control flow.
**Proof:** [check-then-insert](/postgres/05-patterns/check-then-insert)

## 3. A customer is charged twice

**Broken:** the client retried; the operation ran twice, each run individually correct.
**Fix:** an idempotency key — gate and work in one transaction.
**Proof:** [idempotency keys](/postgres/05-patterns/idempotency)

## 4. An invariant across rows breaks with no error

**Broken:** "at least one doctor on call" checked per-transaction; two transactions
update *different* rows — write skew, invisible to every level below SERIALIZABLE.
**Fix:** SERIALIZABLE (plus retries), or serialize explicitly with a lock.
**Proof:** [write skew](/postgres/02-isolation/serializable)

## 5. A "trivial" migration takes the site down

**Broken:** `ALTER TABLE` queued behind one long reader; every later query queued
behind the `ALTER` — the queue, not the DDL, is the outage.
**Fix:** `lock_timeout` around DDL, split risky changes into stages.
**Proof:** [table locks & DDL](/postgres/03-locking/table-locks-and-ddl)

## 6. The connection pool is empty, but the database is idle

**Broken:** sessions parked `idle in transaction` — an ORM or a stray `await` between
BEGIN and COMMIT — each holding locks and a pooled connection.
**Fix:** `idle_in_transaction_session_timeout` / `transaction_timeout`, and fix the code.
**Proof:** [ORM pitfalls](/postgres/05-patterns/orm-pitfalls) ·
[find & kill them](/postgres/08-production/long-and-idle-transactions)

## 7. A table keeps growing though rows are deleted

**Broken:** DELETE only [marks tuples dead](/postgres/04-mvcc/dead-tuples-and-bloat); one old
transaction — even read-only — keeps VACUUM from reclaiming anything.
**Fix:** keep transactions short; monitor the vacuum dashboard; hunt the oldest xact.
**Proof:** [long transactions](/postgres/04-mvcc/long-transactions) ·
[bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health)

## 8. Random `40001` errors under load

**Broken:** treating serialization failures as bugs (or worse, ignoring them) — at
REPEATABLE READ and SERIALIZABLE they are the *design*.
**Fix:** a retry loop around every RR/SSI transaction; keep transaction bodies re-runnable.
**Proof:** [the retry wrapper](/postgres/05-patterns/retrying-serialization-failures)

## 9. Two workers process the same job

**Broken:** claiming jobs with a plain `SELECT`, or marking them "running" in a
transaction that then crashes and revives nothing.
**Fix:** claim–work–complete inside one transaction with `FOR UPDATE SKIP LOCKED`.
**Proof:** [the job queue](/postgres/05-patterns/job-queue)

## 10. Events reach the broker for data that doesn't exist (or never reach it)

**Broken:** writing the database and publishing to a broker as two separate writes.
**Fix:** the transactional outbox; accept at-least-once, make consumers idempotent.
**Proof:** [dual writes & the outbox](/postgres/06-distributed/transactional-outbox)

## 11. Locks are held, VACUUM is stuck — and no session owns any of it

**Broken:** an orphaned prepared transaction from a two-phase commit whose coordinator
died between the phases. Nothing expires it.
**Fix:** `SELECT gid FROM pg_prepared_xacts;` then `COMMIT PREPARED` / `ROLLBACK PREPARED`.
**Proof:** [two-phase commit](/postgres/06-distributed/two-phase-commit)

## 12. A deadlock — and both transactions looked innocent

**Broken:** two code paths locking the same rows in different orders.
**Fix:** consistent lock ordering; retry `40P01` like `40001`; watch the counter.
**Proof:** [deadlocks](/postgres/03-locking/deadlocks) ·
[the permanent trace](/postgres/08-production/logs-and-counters)

## 13. A job queue balloons on disk while autovacuum runs clean

**Broken:** the [job queue](/postgres/05-patterns/job-queue) loop is correct, but one worker hangs
mid-transaction and never commits. Its snapshot pins the vacuum horizon, so every job the queue
drains during the hang leaves a dead version VACUUM can't reclaim — the table grows with throughput
while autovacuum runs on schedule and cleans nothing.
**Fix:** switch to claim-by-state with a short transaction and a reaper
([job queue](/postgres/05-patterns/job-queue)); watch the
[bloat & vacuum dashboard](/postgres/08-production/bloat-and-vacuum-health) so the slope shows up
before the disk does.
**Proof:** [queue bloat from a hung worker](/postgres/07-pitfalls/queue-bloat)

This is entries [7](#_7-a-table-keeps-growing-though-rows-are-deleted) and
[9](#_9-two-workers-process-the-same-job) composed: the queue's SKIP LOCKED loop meets the frozen
horizon, and the bill is a rate neither half predicts on its own.

---

MySQL has different sharp edges — [its own compendium](/mysql/07-pitfalls/compendium) covers the traps PostgreSQL doesn't have.
