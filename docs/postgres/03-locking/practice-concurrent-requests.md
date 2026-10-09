---
description: Predict concurrent PostgreSQL requests and justify recovery before opening each answer.
---

# Practice: concurrent requests

Use PostgreSQL 18.6 and the stated boundaries. Work on paper without installing anything: predict each response, name the decisive relationship between sessions, and choose a repair with its limits. Evidence and optional replay are inside the answers.

## One account

The committed account `(id, balance)` is `(1, 100)`. Use READ COMMITTED. B's statements run separately in autocommit.

| Step | A | B |
| --- | --- | --- |
| 1 | BEGIN; SELECT * FROM accounts WHERE id = 1 FOR UPDATE | |
| 2 | | SELECT balance FROM accounts WHERE id = 1 |
| 3 | | Send UPDATE accounts SET balance = balance - 10 WHERE id = 1 |
| 4 | UPDATE accounts SET balance = 150 WHERE id = 1; COMMIT | |
| 5 | | After the UPDATE returns, SELECT balance FROM accounts WHERE id = 1 |

Predict the SELECT results and whether B's UPDATE can complete before step 4. Does this schedule require a transaction abort? Explain which requested resource matters. If B has a response deadline, propose a scoped repair.

<details>
<summary>Check the account requests</summary>

**Result:** B reads 100, its UPDATE waits until A commits, and its later read returns 140. This is a one-way wait, not a deadlock: B needs A's row lock, but A needs no resource held by B.

**Decisive reasoning:** the ordinary SELECT does not request a conflicting row lock. The UPDATE does. After A commits 150, B applies its decrement to that committed target.

**Plausible wrong answer:** “FOR UPDATE prevents every read” or “any wait is a deadlock.” Neither describes these requests. The transcript asserts the wait and final balance, not a maximum response time.

**Repair:** keep A's transaction short. B can set a nonzero `lock_timeout` to bound each lock acquisition and handle failure. The separate asserted timeout replay returns `55P03`; after A commits, a fresh standalone attempt succeeds.

**Limits:** a timeout does not make the requested operation succeed or impose a total statement deadline. In this autocommit case the failed implicit transaction ends. In an explicit transaction, roll back or recover through a previously established savepoint before ordinary commands can continue. Retrying a replacement computed earlier is not equivalent to this relative decrement. Other resources can still cause waits.

**Evidence and optional replay:** [row requests](/postgres/03-locking/row-locks#an-ordinary-select-succeeds-while-update-waits) and [timeout scope](/postgres/03-locking/nowait-skip-locked#lock-timeout-bounded-patience). After [local setup](/about/run-locally), run one at a time:

```sh
bun lesson postgres/03-locking/for-update-blocks
bun lesson postgres/03-locking/lock-timeout
```

</details>

## Two transfers

Reset to accounts 1 and 2, each with balance 100. Both transactions use READ COMMITTED. Set A's `deadlock_timeout` to `10s` and B's to `50ms`, as in the controlled replay. Each transfer must debit one account and credit the other together.

| Step | A | B |
| --- | --- | --- |
| 1 | BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 1 | |
| 2 | | BEGIN; UPDATE accounts SET balance = balance - 25 WHERE id = 2 |
| 3 | Send UPDATE accounts SET balance = balance + 10 WHERE id = 2 | |
| 4 | | Send UPDATE accounts SET balance = balance + 25 WHERE id = 1 |

Predict the relationship after step 3 and after step 4. Can both transfers finish by waiting? Predict the controlled replay's error and final balances when the surviving transfer commits and the other session rolls back. Explain what must be repeated and how changing acquisition order could help.

<details>
<summary>Check the transfer requests</summary>

**Result:** step 3 creates A waiting for B. Step 4 adds B waiting for A, a lock cycle. In this controlled schedule B receives `40P01`, A completes and commits, and B rolls back. The asserted balances are 90 and 110. The timeout settings do not promise a general victim choice or measured detection latency.

**Decisive reasoning:** each transaction already holds the row the other requests. Waiting alone cannot release either lock. This is a lock deadlock, distinct from a logical serialization dependency.

**Plausible wrong answer:** “Retry only B's credit, because only that statement failed.” B cannot continue ordinary commands in the failed transaction. Its earlier debit does not commit, so replaying only the credit would not perform the intended transfer.

**Repair:** roll back and, if the business operation remains valid, retry the whole transfer with fresh reads and bounded retries. For this two-row workload, all participating writers can acquire both required row locks in id order before changing either balance. The separate repair replay makes B wait before it owns a row A needs; both then commit at 115 and 85.

**Limits:** another transaction can be the victim. Consistent order must include all conflicting resources and writers; this two-row replay proves no universal deadlock freedom. A retry can fail again, and database rollback does not undo external effects. Savepoint recovery is a separate protocol, not demonstrated by this transfer replay.

**Evidence and optional replay:** [both asserted transfers and the scoped ordering argument](/postgres/03-locking/deadlocks). After [local setup](/about/run-locally):

```sh
bun lesson postgres/03-locking/deadlock
bun lesson postgres/03-locking/deadlock-avoidance
```

</details>

Try [the MySQL requests](/mysql/03-locking/practice-concurrent-requests) before opening their answers.
