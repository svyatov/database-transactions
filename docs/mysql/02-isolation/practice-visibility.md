---
description: Predict InnoDB row visibility at each step before opening the explanations and optional replays.
---

# Practice: reading rows

Use MySQL 8.4.11 with InnoDB tables and the exact transaction boundaries below. Work on paper: predict each requested result and explain which operation and read view determine it. No installation is needed. Evidence and optional local replay are inside each answer; open them after making your predictions.

## A reporting interval

The committed rows initially contain `(id, balance)` pairs `(1, 100)` and `(2, 50)`. B's statements below run in autocommit. All A's table reads are consistent nonlocking SELECTs.

| Step | A | B |
| --- | --- | --- |
| 1 | `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; BEGIN` | |
| 2 | | `UPDATE accounts SET balance = 120 WHERE id = 1` |
| 3 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 4 | | `UPDATE accounts SET balance = 999 WHERE id = 1` |
| 5 | | `INSERT INTO accounts VALUES (3, 'carol', 300)` |
| 6 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 7 | `UPDATE accounts SET balance = balance + 10 WHERE id = 2` | |
| 8 | `SELECT id, balance FROM accounts ORDER BY id` | |
| 9 | `COMMIT`, then the same standalone SELECT | |

The table also has an `owner` column; the initial owners are alice and bob. Predict the ordered rows at steps 3, 6, 8, and 9. Explain whether BEGIN sets the boundary and whether A's UPDATE changes what its next SELECT can see. If a report must retain its starting values, what must its reader avoid?

<details>
<summary>Check the reporting interval</summary>

**Result:** step 3 returns `(1, 120), (2, 50)`; step 6 returns those same rows; step 8 returns `(1, 120), (2, 60)`; step 9 returns `(1, 999), (2, 60), (3, 300)`.

**Decisive reasoning:** step 3 is A's first consistent table read. B's 120 was committed before it. The retained read view excludes B's later 999 and insertion, but A's earlier own change to row 2 is visible. The standalone read after COMMIT takes a new view.

**Plausible wrong answer:** “Step 3 must return 100 because A began first.” BEGIN alone did not take this read view. Another wrong answer is that row 2 must remain 50 at step 8: own writes are visible.

**Repair:** for a report that must retain its starting view, use a short REPEATABLE READ transaction with consistent nonlocking reads and no changes to the reported data. To read later committed data, finish it and start a new transaction.

**Limits:** do not mix current reads or your own writes into an assumed fixed report view. A retained view does not prove a cross-row business rule or reserve future data. `START TRANSACTION WITH CONSISTENT SNAPSHOT` has a separate documented timing rule; this schedule does not execute it. No report performance is measured.

**Evidence:** [the asserted snapshot schedule](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms) and [the MySQL 8.4 contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html): “the query sees the changes made by earlier statements within the same transaction.” These are observed results and a documented rule, not an exhaustive isolation proof.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson mysql/02-isolation/stable-snapshot`.

</details>

## Two operations on one row

One committed account starts at balance 100. A sets REPEATABLE READ before BEGIN and performs `SELECT balance FROM accounts WHERE id = 1`. B then runs an autocommit UPDATE to 150. A repeats that plain SELECT and continues in this order:

```sql
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
SELECT balance FROM accounts WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
SELECT balance FROM accounts WHERE id = 1;
```

Predict every A read after B's UPDATE and whether any statement fails in this schedule. B also performs a standalone plain read before and after A commits; predict both. Explain whether the locking read replaces A's consistent-read view, and which value supplies the UPDATE's arithmetic.

<details>
<summary>Check the two operations</summary>

**Result:** A's repeated plain read returns 100. Its locking read returns 150, the following plain read still returns 100, and the plain read after its UPDATE returns 200. These statements succeed. B reads 150 before A commits and 200 afterward.

**Decisive reasoning:** the consistent reads retain the earlier view. SELECT FOR UPDATE uses the current row and locks it, without refreshing that view. UPDATE also uses the current target: 150 plus 50 gives 200. A's own write then becomes visible to its consistent read; B cannot read that uncommitted change at its standalone default REPEATABLE READ.

**Plausible wrong answer:** “The locking SELECT fails with PostgreSQL's post-snapshot conflict.” That transfers a different engine's rule. Another wrong answer is that the next plain SELECT returns 150 just because the lock was acquired; locking is not a read-view refresh.

**Repair:** if the application must read a row and compute a change from that value, all participating writers can use SELECT FOR UPDATE before computing and save in the same short transaction. For a report needing a new consistent view, end the old transaction and read in a fresh one. Choose the repair for the actual task.

**Limits:** current reads can wait, deadlock, or fail; this uncontended locking read does not promise success in every schedule. A row lock does not protect an arbitrary cross-row rule. Mixing current reads, retained consistent reads, and own writes does not make a report one historical database state. No physical undo records are inspected here.

**Evidence:** [the complete asserted schedule and static visibility model](/mysql/02-isolation/repeatable-read#reading-and-locking-one-row), [the waiting UPDATE schedule](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot), and the [MySQL locking-read contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html). The model explains reconstruction, not another storage observation.

**Optional replay:** after [local setup](/about/run-locally), run these one at a time:

```sh
bun lesson mysql/02-isolation/visibility-operations
bun lesson mysql/02-isolation/current-reads
```

</details>

## Two statements in a report

Reset to one committed account at 100. A sets READ COMMITTED before BEGIN, then runs a consistent nonlocking `SELECT balance FROM accounts WHERE id = 1`. B runs an autocommit UPDATE to 200. A repeats the same SELECT before COMMIT.

Predict both reads. Does one BEGIN make them a single view? Choose a repair if the application requires several reads from one view, and explain what the repair cannot guarantee.

<details>
<summary>Check the two statements</summary>

**Result:** A reads 100, then 200.

**Decisive reasoning:** READ COMMITTED gives each consistent nonlocking read a fresh view. B's commit lies between the two boundaries.

**Plausible wrong answer:** “Both return 100 because InnoDB always keeps one view until COMMIT.” That describes retained consistent reads at REPEATABLE READ, not this selected level.

**Repair:** use one short REPEATABLE READ transaction for related consistent nonlocking reads without changing the reported data, as in the reporting interval. A single consistent query is another option when it can express the report.

**Limits:** this repair concerns consistent table reads, not every SQL operation. UPDATE and locking reads still use current targets. A stable report does not reserve future state or prove serializability. This excerpt demonstrates two reads, not every possible report or query plan.

**Evidence:** [the asserted two-read excerpt](/mysql/02-isolation/read-committed#non-repeatable-reads) and [the READ COMMITTED updating example](/mysql/02-isolation/read-committed#after-the-wait-the-re-check). A waiting UPDATE can recheck a changed target; it is not equivalent to a consistent nonlocking read.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson mysql/02-isolation/non-repeatable-read`.

</details>

## A conditional change

Reset to committed InnoDB items `(id, value)` of `(1, 10)` and `(2, 30)`. A begins at the default REPEATABLE READ and runs `UPDATE items SET value = value * 2 WHERE id = 1`, without committing. B sets READ COMMITTED before BEGIN and sends:

```sql
UPDATE items SET value = 99 WHERE value = 10;
```

Next, A commits. Predict whether B's UPDATE must wait for that commit, its affected-row count, and the rows from B's `SELECT id, value FROM items ORDER BY id` after B commits. Explain which target version supplies the decisive predicate check. What must B inspect if its intended change was required for success?

<details>
<summary>Check the conditional change</summary>

**Result:** B waits for A's row lock, then affects zero rows. After B commits, its SELECT returns `(1, 20), (2, 30)`.

**Decisive reasoning:** InnoDB READ COMMITTED can use the committed version to check whether a locked row qualifies for UPDATE. After the wait, the current target is 20, so the predicate no longer matches. B does not write 99. This updating operation differs from a consistent nonlocking SELECT.

**Plausible wrong answer:** “B's transaction saw value 10, so its UPDATE must write 99 after the lock is released.” A prior or preliminary view does not freeze the UPDATE's predicate match. SQL success alone does not mean a row changed.

**Repair:** check the affected-row count and handle zero as an unmet condition. For a protected read-and-change decision, all participating writers can lock the target before computing within the same short transaction.

**Limits:** zero rows can also mean deletion; inspect state and reconsider the operation. Locks can wait or deadlock. This is the executed READ COMMITTED predicate schedule, not PostgreSQL's REPEATABLE READ conflict rule. InnoDB current-row writes can also occur at REPEATABLE READ, as the two-operations exercise demonstrates.

**Evidence:** [the asserted wait, zero count, and final rows](/mysql/02-isolation/read-committed#after-the-wait-the-re-check).

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson mysql/02-isolation/update-recheck`.

</details>

Try [the PostgreSQL reading practice](/postgres/02-isolation/practice-visibility) without opening its answers, or return to [two writers](/mysql/02-isolation/practice-two-writers).
