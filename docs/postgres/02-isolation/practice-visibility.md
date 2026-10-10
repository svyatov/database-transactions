---
description: Predict PostgreSQL row visibility at each step before opening the explanations and optional replays.
---

# Practice: reading rows

Use PostgreSQL 18.6 and the exact transaction boundaries below. Work on paper: predict each requested result and explain which operation and snapshot determine it. No installation is needed. Evidence and optional local replay are inside each answer; open them after making your predictions.

## A reporting interval

The committed rows initially contain `(id, balance)` pairs `(1, 100)` and `(2, 50)`. B's statements below run in autocommit. All A's table reads are ordinary SELECTs without locking clauses.

| Step | A | B |
| --- | --- | --- |
| 1 | `BEGIN ISOLATION LEVEL REPEATABLE READ` | |
| 2 | | `UPDATE accounts SET balance = 101 WHERE id = 1` |
| 3 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 4 | | `UPDATE accounts SET balance = 999 WHERE id = 1` |
| 5 | | `INSERT INTO accounts VALUES (3, 'carol', 300)` |
| 6 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 7 | `UPDATE accounts SET balance = 60 WHERE id = 2` | |
| 8 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 9 | `COMMIT`, then the same standalone SELECT | |

The table also has an `owner` column; the initial owners are alice and bob. Predict the ordered rows at steps 3, 6, 8, and 9. Explain whether BEGIN sets the boundary and whether A's UPDATE changes what its next SELECT can see. If a report must retain its starting values, what must its reader avoid?

<details>
<summary>Check the reporting interval</summary>

**Result:** step 3 returns `(1, 101), (2, 50)`; step 6 returns those same rows; step 8 returns `(1, 101), (2, 60)`; step 9 returns `(1, 999), (2, 60), (3, 300)`.

**Decisive reasoning:** the first non-transaction-control statement in A is step 3. B's 101 was committed before it. B's later 999 and insertion are outside that retained snapshot. A sees its own earlier change to row 2. The standalone read after COMMIT uses a fresh transaction.

**Plausible wrong answer:** “Step 3 must return 100 because A began before B wrote 101.” BEGIN alone did not establish this snapshot. Another wrong answer is that step 8 must still return 50 for row 2: own writes remain visible.

**Repair:** for a report that must keep its starting view, use a short REPEATABLE READ transaction containing ordinary reads and no changes to the reported data. If the task instead needs later committed data, end the transaction and read in a fresh one.

**Limits:** a stable view is not proof of a cross-row business rule or a serial ordering. Own writes can change results. A fresh view is current only at its snapshot boundary; it does not reserve future state. This schedule measures no reporting performance.

**Evidence:** [the asserted snapshot schedule](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) and the [PostgreSQL 18 contract](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ). The contract states: “each query does see the effects of previous updates executed within its own transaction”. These are observed SQL results and a documented rule, not an exhaustive isolation proof.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/stable-snapshot`.

</details>

## Two operations on one row

One committed account starts at balance 100. A begins at REPEATABLE READ and performs `SELECT balance FROM accounts WHERE id = 1`. B then runs an autocommit UPDATE to 150. A performs the same plain SELECT and then:

```sql
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
```

Predict the second plain read and the locking statement's result or error. If the attempt cannot continue, A rolls it back and starts a fresh REPEATABLE READ attempt with that locking SELECT. In the attempt that can continue, A runs `UPDATE accounts SET balance = balance + 50 WHERE id = 1`, then reads balance before COMMIT. B also performs a standalone plain read before and after A commits. Predict all three later reads. Explain whether adding FOR UPDATE always supplies the latest committed value at this level.

<details>
<summary>Check the two operations</summary>

**Result:** A's repeated plain read returns 100; the first locking SELECT fails with `40001`. After ROLLBACK, the fresh attempt locks and returns 150. A writes and reads its own 200. B reads 150 before A commits and 200 afterward.

**Decisive reasoning:** B actually changed the target after A's retained snapshot. PostgreSQL REPEATABLE READ refuses to lock that changed version. A's fresh attempt establishes a new snapshot including 150. Its own UPDATE is visible before commit, while B cannot read that uncommitted change.

**Plausible wrong answer:** “FOR UPDATE returns 150 and refreshes A's old transaction.” That imports InnoDB's current-read behavior into PostgreSQL REPEATABLE READ. Nor does the conflict mean a completed update or deposit.

**Repair:** roll back the failed attempt and repeat the whole transaction, including reads and decisions, with bounded retry handling. To coordinate a read-and-change operation, cooperating writers can lock the row before computing within the same short transaction.

**Limits:** a retry can conflict again. Locking later does not preserve a decision computed from an earlier stale read. PostgreSQL READ COMMITTED has different updating/locking rules; do not generalize this error to every isolation level. Single-row locks do not protect arbitrary cross-row rules or external effects.

**Evidence:** [the complete asserted schedule and static visibility model](/postgres/02-isolation/repeatable-read#reading-and-locking-one-row); [the manual's locking rule](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ). The model explains versions; it is not another physical-page observation.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/visibility-operations`.

</details>

## Two statements in a report

Reset to one committed account at 100. A runs `BEGIN ISOLATION LEVEL READ COMMITTED`, then a plain `SELECT balance FROM accounts WHERE id = 1`. B runs an autocommit UPDATE to 200. A repeats the same SELECT before COMMIT.

Predict both reads. Does one BEGIN make them a single view? Choose a repair if the application requires several reads from one view, and explain what the repair cannot guarantee.

<details>
<summary>Check the two statements</summary>

**Result:** A reads 100, then 200.

**Decisive reasoning:** each plain SELECT at READ COMMITTED takes a new command snapshot. B commits between those boundaries.

**Plausible wrong answer:** “Both return 100 because A has not committed.” Transaction duration alone does not select snapshot duration.

**Repair:** put the related ordinary reads in one REPEATABLE READ transaction, as in the reporting interval above, without writing the reported data. A single ordinary query is another option when it can express the report.

**Limits:** the REPEATABLE READ repair supplies visibility, not a reservation of rows or proof of serializability. Updating and locking commands have their own rules. This excerpt demonstrates two reads, not every possible report or query plan.

**Evidence:** [the asserted two-read excerpt](/postgres/02-isolation/read-committed#non-repeatable-reads) and [READ COMMITTED updating rules](/postgres/02-isolation/read-committed#the-subtle-one-update-re-checks-its-where-clause). For example, a waiting UPDATE can recheck a changed target; it is not equivalent to a plain snapshot read.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/non-repeatable-read`.

</details>

## A conditional change

Reset to committed items `(id, value)` of `(1, 10)` and `(2, 30)`. A begins at READ COMMITTED and runs `UPDATE items SET value = value * 2 WHERE id = 1`, without committing. B, in autocommit at READ COMMITTED, sends:

```sql
UPDATE items SET value = 99 WHERE value = 10;
```

Next, A commits. Predict whether B's UPDATE must wait for that commit, its affected-row count, and the rows from B's subsequent `SELECT id, value FROM items ORDER BY id`. Explain which target version supplies the decisive predicate check. What must B inspect if its intended change was required for success?

<details>
<summary>Check the conditional change</summary>

**Result:** B waits for A's row lock, then affects zero rows. Its final SELECT returns `(1, 20), (2, 30)`.

**Decisive reasoning:** B initially finds the committed target with value 10. After A commits, this READ COMMITTED UPDATE rechecks the changed target at 20. The predicate no longer matches; B does not write 99. An updating command is not simply a plain SELECT with the same snapshot rules.

**Plausible wrong answer:** “B saw 10 at command start, so it must eventually replace that row with 99.” The predicate is checked again after the wait. A successful SQL response alone does not mean a row was changed.

**Repair:** check the affected-row count and treat zero as an unmet condition. If a read-and-change decision must be protected, cooperating writers can lock before reading and computing in the same transaction; a prior plain read does not reserve the row.

**Limits:** zero rows can have other causes, including deletion. Inspect state and reconsider the operation rather than blindly resending a replacement. Locks can wait or deadlock. At PostgreSQL REPEATABLE READ a post-snapshot target change can instead cause 40001; the two-operations exercise covers that distinct rule.

**Evidence:** [the asserted wait, zero count, and final rows](/postgres/02-isolation/read-committed#the-subtle-one-update-re-checks-its-where-clause).

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/update-recheck`.

</details>

Try [the MySQL reading practice](/mysql/02-isolation/practice-visibility) without opening its answers, or return to [two writers](/postgres/02-isolation/practice-two-writers).
