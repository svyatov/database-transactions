---
description: Predict concurrent InnoDB requests and justify recovery before opening each answer.
---

# Practice: concurrent requests

Use MySQL 8.4.11 with InnoDB, REPEATABLE READ, and `innodb_deadlock_detect=ON`. Work on paper without installation: predict each response, explain the decisive relationship, and choose a repair with its limits. Evidence and optional replay are inside the answers.

## One account

The committed account `(id, balance)` is `(1, 100)`. B's statements run separately in autocommit.

| Step | A | B |
| --- | --- | --- |
| 1 | BEGIN; SELECT * FROM accounts WHERE id = 1 FOR UPDATE | |
| 2 | | SELECT balance FROM accounts WHERE id = 1 |
| 3 | | Send UPDATE accounts SET balance = balance - 10 WHERE id = 1 |
| 4 | UPDATE accounts SET balance = 150 WHERE id = 1; COMMIT | |
| 5 | | After the UPDATE returns, SELECT balance FROM accounts WHERE id = 1 |

Predict both SELECT results and whether B's UPDATE can finish before step 4. Is a transaction abort necessary? Explain the resource relationship and propose a repair if B has a response deadline.

<details>
<summary>Check the account requests</summary>

**Result:** B reads 100, its UPDATE waits, then its later read returns 140. This is a one-way wait, not a deadlock: B needs A's record lock, but A needs no resource B holds.

**Decisive reasoning:** B's consistent SELECT does not request a conflicting record lock. Its UPDATE does, and applies the decrement to A's committed 150 after the wait.

**Plausible wrong answer:** “REPEATABLE READ makes the UPDATE subtract from the earlier 100” or “every blocked request is a deadlock.” Updating and consistent-reading operations differ here.

**Repair:** keep A's transaction short. Use `innodb_lock_wait_timeout` and handle `1205` when a row-lock wait exceeds the configured limit. End or reconsider the attempt according to the operation's transaction boundary.

**Limits:** a timeout does not complete the operation or establish a total statement deadline. With `innodb_rollback_on_timeout=OFF`, only the timed-out statement is rolled back; an explicit transaction can retain prior changes and locks. The later practice item checks that scope. Metadata waits have different controls. This relative decrement is not a stale literal replacement.

**Evidence and optional replay:** [the asserted row schedule](/mysql/03-locking/row-locks). After [local setup](/about/run-locally), run `bun lesson mysql/03-locking/for-update-blocks`.

</details>

## Two transfers

Reset to accounts 1 and 2, each with balance 100. Each transfer must debit one account and credit the other together.

| Step | A | B |
| --- | --- | --- |
| 1 | BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 1 | |
| 2 | | BEGIN; UPDATE accounts SET balance = balance - 25 WHERE id = 2 |
| 3 | Send UPDATE accounts SET balance = balance + 10 WHERE id = 2 | |
| 4 | | Send UPDATE accounts SET balance = balance + 25 WHERE id = 1 |

Predict whether each request completes, waits, or fails after each of the last two steps, and explain the relationship between the sessions. Can both transfers finish just by waiting? If you predict a failure, identify the error and required recovery. For the outcome you predict, state which transfers can commit and calculate the resulting balances. Explain what must be repeated, if anything, and how acquisition order could change the relationship.

<details>
<summary>Check the transfer requests</summary>

**Result:** step 3 makes A wait for B; step 4 closes a lock cycle. In this replay B receives `1213` (SQLSTATE `40001`), its whole transaction is rolled back, and A commits balances 90 and 110. The application must not rely on B always being the victim.

**Decisive reasoning:** each transaction owns a record lock the other needs. Deadlock detection breaks that cycle. This is not a row-lock timeout or a logical serialization-dependency diagram.

**Plausible wrong answer:** “Only B's last statement rolled back, so send its credit again.” Its earlier debit was undone too. Sending only the credit would not execute the intended transfer.

**Repair:** if still appropriate, retry the whole transaction with fresh reads and bounded retries. All writers in this two-row protocol can acquire both rows in id order before modifying either. The asserted repair schedule makes B wait before holding a row A needs; both transfers commit at 115 and 85.

**Limits:** ordering must cover the participating writers and resources. Other queries, indexes, foreign-key checks, or metadata locks can introduce other cycles. Detection latency and universal deadlock freedom are not measured. External effects are not undone by database rollback.

**Evidence and optional replay:** [the two asserted transfer schedules](/mysql/03-locking/deadlocks). After [local setup](/about/run-locally), run one at a time:

```sh
bun lesson mysql/03-locking/deadlock
bun lesson mysql/03-locking/deadlock-avoidance
```

</details>

## A timed request

Reset to accounts 1 and 2 at 100. Use `innodb_rollback_on_timeout=OFF`. C's statement runs in autocommit.

| Step | A | B | C |
| --- | --- | --- | --- |
| 1 | BEGIN; UPDATE accounts SET balance = 200 WHERE id = 1 | | |
| 2 | | SET SESSION innodb_lock_wait_timeout = 1; BEGIN; UPDATE accounts SET balance = 125 WHERE id = 2 | |
| 3 | | Send UPDATE accounts SET balance = 300 WHERE id = 1; wait for its response | |
| 4 | | SELECT balance FROM accounts WHERE id = 2 | |
| 5 | | | Send UPDATE accounts SET balance = balance + 1 WHERE id = 2 |
| 6 | | ROLLBACK | |

Predict B's response and read, whether C can finish before step 6, and C's resulting balance afterward. Draw the request relationships. Does increasing the timeout repair a cycle here? Choose a safe response for an application that requires B's two changes together.

<details>
<summary>Check the timed request</summary>

**Result:** B receives `1205`, then reads its own 125. C waits until B rolls back, then writes and reads 101. At step 3 B waits for A; after that request times out, step 5 makes C wait for B. These are successive one-way waits, not a simultaneous cycle.

**Decisive reasoning:** with the stated setting, the timeout rolls back B's failed statement, not its earlier work or record lock. ROLLBACK removes that earlier change and releases the lock C needs.

**Plausible wrong answer:** “1205 rolled back everything just like 1213.” The error scope differs. Raising the limit changes patience, not the resources or atomic boundary.

**Repair:** for the two-change operation, explicitly roll back the incomplete attempt. After the blocker finishes, reconsider and retry the whole operation if valid, rather than committing a partial result.

**Limits:** `innodb_rollback_on_timeout=ON` changes recovery scope. The replay checks OFF and ends B's transaction; it does not demonstrate a universal retry policy. A longer wait can still expire. Database rollback does not remove effects outside that transaction.

**Evidence and optional replay:** [the asserted timeout, retained change, and C's wait](/mysql/03-locking/nowait-skip-locked). After [local setup](/about/run-locally), run `bun lesson mysql/03-locking/lock-timeout`.

</details>

## A new booking

Reset to `bookings(slot int PRIMARY KEY, guest varchar(20) NOT NULL)` with keys 10, 20, 30 and guests alice, bob, carol. No other index or constraint is involved. Both sessions use REPEATABLE READ. A begins and runs:

```sql
SELECT slot FROM bookings WHERE slot BETWEEN 10 AND 20 FOR UPDATE;
```

B begins and sends `INSERT INTO bookings VALUES (15, 'mallory')`. A later commits; B commits when its INSERT returns. Predict whether B can complete before A's commit and explain which index relationship decides it. Afterward A starts a READ COMMITTED transaction with the same locking query, and B sends an autocommit insertion of 17. Predict this second response before A commits. Choose a repair without changing the application's rule silently.

<details>
<summary>Check the booking requests</summary>

**Result:** insertion of 15 waits at REPEATABLE READ. The replay asserts its waiting mode as `X,GAP,INSERT_INTENTION`; it completes after A commits. At READ COMMITTED, insertion of 17 completes while A's read remains open.

**Decisive reasoning:** the first PRIMARY-index range scan protects an index gap containing 15, even though no row has that key. After 15 commits, 17 lies between keys 15 and 20; the second scan runs under different gap-locking rules. The [index-gap mechanism and text equivalent](/mysql/03-locking/gap-locks#index-interval-mechanism) show this relationship, alongside the unchanged generated timeline.

**Plausible wrong answer:** “No row 15 exists, so there can be no conflicting lock.” Inserts request access to index intervals as well as creating records. Nor is this single directed wait a deadlock.

**Repair:** keep the reservation transaction short and release it promptly. READ COMMITTED is an option only if permitting insertion during the decision fits the business rule; it changes visibility and search gap locking, not just wait duration.

**Limits:** the result is scoped to this query, PRIMARY index, keys, and levels. Other access paths can scan different intervals. Foreign-key and duplicate-key checks can still require gap locks at READ COMMITTED. The observed wait mode does not measure every lock or interval held by A. No second insertion cycle or booking application is executed here.

**Evidence and optional replay:** [the asserted range and insert schedule](/mysql/03-locking/gap-locks). After [local setup](/about/run-locally), run `bun lesson mysql/03-locking/gap-locks`.

</details>

Try [the PostgreSQL requests](/postgres/03-locking/practice-concurrent-requests) before opening their answers.
