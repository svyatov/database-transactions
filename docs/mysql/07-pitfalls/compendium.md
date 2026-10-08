# Pitfalls compendium

Selected MySQL 8.4 InnoDB failure schedules, keyed by symptoms. These symptoms are not
unique diagnoses. Each entry states what its linked evidence establishes and the
conditions of a possible repair. For an incident, start with the
[symptom triage table](/mysql/08-production/symptom-triage).

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
15. [A deadlock, and both transactions looked innocent](#_15-a-deadlock-and-both-transactions-looked-innocent)

## 1. Increments vanish under load

**Observed:** the linked READ COMMITTED and REPEATABLE READ schedules read a balance in
the application and later overwrite a concurrent deposit with a stale value.
**Repair scope:** the single-row repairs use arithmetic SQL, participating writers'
`FOR UPDATE` transactions, or checked version predicates with conflict handling.
They do not protect every cross-row business rule.
**Proof:** [the lost update](/mysql/02-isolation/lost-update) ·
[all three fixes](/mysql/05-patterns/fixing-lost-updates)

## 2. Duplicates despite an "is it taken?" check

**Observed:** two plain checks see no matching email; without a unique constraint,
both inserts commit.
**Repair scope:** enforce the intended unique key in the database. The linked
`ON DUPLICATE KEY UPDATE` schedule arbitrates one such key; multiple unique keys and
affected-row client flags require care.
**Proof:** [check-then-insert](/mysql/05-patterns/check-then-insert)

## 3. A customer is charged twice

**Observed:** committed and in-flight same-key duplicates skip the demonstrated database
balance update.
**Repair scope:** retain the key and keep the gate and database work in one transaction.
The affected-row branch assumes `CLIENT_FOUND_ROWS` is absent. Remote payment effects and
lost network responses are not executed; this is not an external charge guarantee.
**Proof:** [idempotency keys](/mysql/05-patterns/idempotency)

## 4. An invariant across rows breaks with no error

**Observed:** the linked REPEATABLE READ doctor schedule commits changes to different
rows and leaves nobody on call; its SERIALIZABLE schedule produces `1213` and a rollback.
**Repair scope:** coordinate all participating writers over the business rule.
SERIALIZABLE transactions need retry handling; an explicit locking protocol must cover
the rule's shared rows or predicate, not just each writer's chosen row.
**Proof:** [write skew](/mysql/02-isolation/serializable)

## 5. Your report's numbers are self-contradictory

**Observed:** the demonstrated REPEATABLE READ plain SELECT and DELETE use different
visibility rules; DELETE affects no row even while the old snapshot still shows it.
**Repair scope:** use locking reads when that protocol fits the decision, and account
for own writes and participating writers. Do not describe all reads as one frozen state.
**Proof:** [current reads](/mysql/02-isolation/repeatable-read) ·
[the DELETE that removes nothing](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds)

## 6. After a timeout, "retrying" corrupted the transaction

**Observed:** with `innodb_rollback_on_timeout=OFF`, InnoDB row-lock `1205` leaves the
transaction's earlier update and lock intact. Restarting the whole operation without
rollback could repeat that work.
**Repair scope:** ROLLBACK before a whole-operation retry. ON requests transaction
rollback; detected deadlock `1213` rolls back the transaction. Do not generalize row-lock
timeout behavior to every error or operation. See the
[MySQL error-handling contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html).
**Proof:** [lock timeouts](/mysql/03-locking/nowait-skip-locked) ·
[deadlocks](/mysql/03-locking/deadlocks)

## 7. A "transactional" migration left half its work behind

**Observed:** CREATE INDEX commits the preceding INSERT, which remains visible after
an explicit ROLLBACK. No migration exception is injected.
**Repair scope:** check the manual's implicit-commit list and exceptions; use a recovery
plan that does not assume this data and schema work rolls back together. One DDL per
migration alone does not establish atomicity.
**Proof:** [implicit commit](/mysql/05-patterns/orm-pitfalls)

## 8. INSERTs block with no duplicate in sight

**Observed:** the linked PRIMARY-index range read at REPEATABLE READ makes insertion
into its gap wait. Its READ COMMITTED comparison permits a later insertion before commit.
**Repair scope:** narrow the query or change isolation only if the resulting protection
fits the rule. READ COMMITTED retains gap locking for foreign-key and duplicate-key
checks; other indexes and statements can differ.
**Proof:** [gap locks](/mysql/03-locking/gap-locks)

## 9. Deadlocks between transactions that "never touch the same row"

**Documented mechanism:** compatible gap locks inhibit insertion. The
[InnoDB gap-lock manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html#innodb-gap-locks)
states: "Gap locks can co-exist." A two-inserter cycle is not executed by the linked
gap schedule; it asserts one blocked insertion. Do not treat this symptom title as a
demonstrated deadlock schedule.
**Repair scope:** inspect actual locks and indexes, reduce coverage where safe, and
handle whole-transaction deadlock retries. Row ordering alone does not prove avoidance
of every range-lock cycle.
**Proof:** [gap locks](/mysql/03-locking/gap-locks) ·
[deadlocks](/mysql/03-locking/deadlocks) · [the retry loop](/mysql/05-patterns/retrying-deadlocks)

## 10. A "trivial" migration takes the site down

**Observed:** the demonstrated ALTER waits behind a transaction's metadata lock, and
a later query queues behind the ALTER.
**Repair scope:** bound metadata-lock acquisition with `lock_wait_timeout` and investigate
holders. This does not bound the entire migration or show that every later query waits.
**Proof:** [table locks & DDL](/mysql/03-locking/table-locks-and-ddl)

## 11. The connection pool is empty, but the database is idle

**Observed:** the production detector identifies one idle transaction and zero modified
rows. Separate schedules demonstrate retained locks and read history. Pool exhaustion
and application I/O are not executed here.
**Repair scope:** shorten transaction lifetimes and use application deadlines with
monitoring. `wait_timeout` closes idle connections, including healthy pooled ones;
MySQL 8.4 has no transaction-specific idle timeout equivalent to PostgreSQL's.
**Proof:** [ORM pitfalls](/mysql/05-patterns/orm-pitfalls) ·
[find & kill them](/mysql/08-production/long-and-idle-transactions)

## 12. Disk keeps growing though no table grew

**Observed:** an old REPEATABLE READ view remains at zero while updates commit and the
history-list metric exceeds an asserted lower bound.
**Repair scope:** investigate retaining views, workload, and purge capacity. Transaction
age does not prove read-view age; ending one candidate does not establish immediate
drainage or disk shrinkage. No retained-byte or disk-growth measurement is made.
**Proof:** [the history list](/mysql/04-mvcc/history-list-length) ·
[history list health](/mysql/08-production/history-list-health)

## 13. Events lost (or invented) between the database and the broker

**Observed model:** one branch omits the stand-in event after the order commits. The
other autocommits the stand-in event before the order INSERT fails with CHECK error `3819`.
Neither branch executes a broker or crash; the second has no explicit order rollback.
The outbox schedule commits or rolls back order and outbox rows together and demonstrates
relay reselection after DELETE rollback.
**Repair scope:** an outbox protects the database-local boundary. Delivery progress,
acknowledgments, retries, and consumer deduplication require a separate protocol;
at-least-once external delivery is not established by this run.
**Proof:** [the dual-write problem](/mysql/06-distributed/transactional-outbox)

## 14. Locks are held, and no session owns them

**Observed:** with `xa_detach_on_prepare=ON`, the prepared branch remains in XA RECOVER
and blocks a NOWAIT read after its session is killed; another connection commits it by XID.
**Repair scope:** recovery needs the coordinator's decision and appropriate privileges.
Do not infer expiry, server-restart recovery, or multi-resource agreement from this run,
and do not choose COMMIT or ROLLBACK arbitrarily.
**Proof:** [XA transactions](/mysql/06-distributed/xa-transactions)

## 15. A deadlock, and both transactions looked innocent

**Observed:** two transactions lock the same rows in opposite orders; InnoDB detects
a deadlock, rolls one transaction back with `1213`, and lets the other finish.
**Repair scope:** consistent ordering avoids the demonstrated cycle when participating
writers follow it. Short transactions and bounded safe retries reduce impact; they do
not promise zero deadlocks.
**Proof:** [deadlocks](/mysql/03-locking/deadlocks) ·
[deadlock avoidance](/mysql/03-locking/deadlocks) ·
[count them in production](/mysql/08-production/logs-and-counters)

---

For PostgreSQL schedules and their scope, see [its compendium](/postgres/07-pitfalls/compendium).
