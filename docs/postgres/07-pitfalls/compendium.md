# Pitfalls compendium

These PostgreSQL examples are keyed by symptoms. Each entry distinguishes the
linked Scenario's observed database behavior from a production hypothesis or
recommended repair. They are not an exhaustive bug list or proof of all schedules.
For a live incident, start with the
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
11. [Locks are held, VACUUM is stuck, and no session owns any of it](#_11-locks-are-held-vacuum-is-stuck-and-no-session-owns-any-of-it)
12. [A deadlock, and both transactions looked innocent](#_12-a-deadlock-and-both-transactions-looked-innocent)
13. [A job queue balloons on disk while autovacuum runs clean](#_13-a-job-queue-balloons-on-disk-while-autovacuum-runs-clean)

## 1. Increments vanish under load

**Broken:** read a value, compute in application code, write it back. At the default
READ COMMITTED, the shown stale absolute writes lose one increment.
**Fix:** relative `SET x = x + …`, `SELECT … FOR UPDATE` in the same transaction,
or a checked version column, under the lesson's participating-writer protocol.
These are single-row repairs, not protection for arbitrary cross-row rules or external effects.
**Proof:** [the lost update](/postgres/02-isolation/lost-update) ·
[all three fixes](/postgres/05-patterns/fixing-lost-updates)

## 2. Duplicates despite an "is it taken?" check

**Broken:** `SELECT` then `INSERT`, both transactions honestly saw no row.
**Fix:** a `UNIQUE` constraint on the intended identity, with `ON CONFLICT` for the
specified conflict path. Other errors still need handling.
**Proof:** [check-then-insert](/postgres/05-patterns/check-then-insert)

## 3. A customer is charged twice

**Example boundary:** the linked Scenario charges a database balance, not a payment
provider. It tests postcommit and in-flight duplicates, not a lost network response.
**Fix:** a stable retained idempotency key, with gate and database-local work in one
transaction and all writers using the protocol. External charges need their own policy.
**Proof:** [idempotency keys](/postgres/05-patterns/idempotency)

## 4. An invariant across rows breaks with no error

**Broken:** "at least one doctor on call" checked per-transaction; two transactions
update *different* rows: the shown REPEATABLE READ schedule breaks the rule.
**Fix:** SERIALIZABLE with bounded complete-transaction retries, or a shared locking
protocol used by every relevant writer. Retry can fail; a lock on only each writer's
different row does not coordinate the rule. General isolation guarantees and their
marked derivations are in the linked lesson.
**Proof:** [write skew](/postgres/02-isolation/serializable)

## 5. A "trivial" migration takes the site down

**Broken:** the shown `ALTER TABLE` waits behind a reader, and a later SELECT waits
behind that incompatible queued request. This is not a claim that every later operation waits.
**Fix:** a workload-specific `lock_timeout` around DDL and staged changes where suitable.
The timeout bounds that wait, not the entire migration or every outage.
**Proof:** [table locks & DDL](/postgres/03-locking/table-locks-and-ddl)

## 6. The connection pool is empty, but the database is idle

**Broken:** sessions parked `idle in transaction` (an ORM or a stray `await` between
BEGIN and COMMIT) can occupy connections and retain locks or cleanup horizons.
The linked Scenarios execute no ORM or connection pool and do not prove pool exhaustion.
**Fix:** tune `idle_in_transaction_session_timeout` or PostgreSQL 17+ `transaction_timeout`,
handle lost connections, and correct the application transaction lifetime.
**Proof:** [ORM pitfalls](/postgres/05-patterns/orm-pitfalls) ·
[find & kill them](/postgres/08-production/long-and-idle-transactions)

## 7. A table keeps growing though rows are deleted

**Broken:** DELETE does not immediately remove [old row versions](/postgres/04-mvcc/dead-tuples-and-bloat); one old
retained snapshot can prevent removal of relevant old versions, even in a read-only
transaction. That does not stop every VACUUM task, and file size can also be reusable space.
**Fix:** keep transaction lifetimes appropriate; investigate horizons, estimates, and
file sizes together. Age alone is not a complete diagnosis.
**Proof:** [long transactions](/postgres/04-mvcc/long-transactions) ·
[bloat & vacuum health](/postgres/08-production/bloat-and-vacuum-health)

## 8. Random `40001` errors under load

**Broken:** treating serialization failures as bugs (or worse, ignoring them). At
REPEATABLE READ and SERIALIZABLE, documented conflict handling can reject work.
**Fix:** a bounded full-transaction retry policy where the business operation permits it.
The linked client Scenario exercises one RR retry; exhaustion, `40P01`, and external
effect deduplication are not executed by that wrapper.
**Proof:** [the retry wrapper](/postgres/05-patterns/retrying-serialization-failures)

## 9. Two workers process the same job

**Example boundary:** the linked queue selects different database rows and makes a
rolled-back selection available again. It executes no task effect, plain-SELECT failure,
worker-process crash, or stale-claim reaper.
**Fix:** the shown `FOR UPDATE SKIP LOCKED` selection and database-local completion
belong in one transaction. It skips conflicting row locks, not all waits, and cannot
promise duplicate-free email, global FIFO order, or prompt crash recovery.
**Proof:** [the job queue](/postgres/05-patterns/job-queue)

## 10. Events reach the broker for data that doesn't exist (or never reach it)

**Model:** separately committed local tables produce an order without an event and
an event without an order. No broker or HTTP service runs.
**Fix:** commit order and outbox intent together. The relay demonstrates rollback,
reselection, and deletion, not delivery. The linked † duplicate-publication inference
explains the external commit boundary; eventual delivery needs retention, retries,
receiver availability, and a consumer repeat policy.
**Proof:** [dual writes & the outbox](/postgres/06-distributed/transactional-outbox)

## 11. Locks are held, VACUUM is stuck, and no session owns any of it

**Example:** the prepared transaction retains a lock and constrains relevant tuple
cleanup after its originating backend is terminated. No coordinator or server crash runs.
**Fix:** inspect `pg_prepared_xacts`, which lists all prepared work, and resolve the
global decision with its owner or coordinator. Permitted owners or superusers can run
`COMMIT PREPARED` or `ROLLBACK PREPARED` outside a transaction block in the same database.
Do not choose a decision solely because a backend is absent. Preparation has no automatic expiry.
**Proof:** [two-phase commit](/postgres/06-distributed/two-phase-commit)

## 12. A deadlock, and both transactions looked innocent

**Broken:** two code paths locking the same rows in different orders.
**Fix:** consistent ordering for the relevant lock set, and a bounded complete-transaction
retry policy for `40P01` when repeatable work permits it. Ordering two rows is not proof
against every kind of deadlock. Watch reset-aware counter rates.
**Proof:** [deadlocks](/postgres/03-locking/deadlocks) ·
[the counter delta](/postgres/08-production/logs-and-counters)

## 13. A job queue balloons on disk while autovacuum runs clean

**Measured case:** one READ COMMITTED worker retains an assigned xid while B completes
1001 jobs. The 1200-row heap grows from 9 to 17 pages; manual VACUUM leaves 2201 occupied
tuple slots. After A commits and another VACUUM runs, that count becomes 1200.
No autovacuum schedule, workload rate, disk-full event, or retained RC snapshot is demonstrated.
**Advice:** shorten transaction lifetimes and investigate the
[vacuum dashboard](/postgres/08-production/bloat-and-vacuum-health). Claimed-state recovery
is a different queue design whose reaper and duplicate-effect policy are not verified here.
**Proof:** [queue bloat from a hung worker](/postgres/07-pitfalls/queue-bloat)

This is entries [7](#_7-a-table-keeps-growing-though-rows-are-deleted) and
[9](#_9-two-workers-process-the-same-job) composed: the queue's SKIP LOCKED loop meets the frozen
horizon. The case measures growth in this schedule, not a universal throughput-to-disk rate.

---

MySQL has different sharp edges: [its own compendium](/mysql/07-pitfalls/compendium) covers the traps PostgreSQL doesn't have.
