---
description: Predict two InnoDB schedules, explain each decision, and justify a repair before opening the answers.
---

# Practice: two writers

Work on paper first. No installation is needed. Use MySQL 8.4.11 with InnoDB tables and the stated transaction boundaries. Write your prediction and its reason before opening each answer.

## Two deposits

One account starts at 100. Each client intends to deposit 10. Each saves the value returned by an ordinary SELECT and computes a literal replacement in application code.

| Step | A | B |
| --- | --- | --- |
| 1 | Set READ COMMITTED; BEGIN; SELECT balance, save 100 | |
| 2 | | Set READ COMMITTED; BEGIN; SELECT balance, save 100 |
| 3 | UPDATE balance = 110; COMMIT | |
| 4 | | UPDATE balance = 110; then attempt COMMIT |

Predict B's UPDATE response and the final committed balance. Explain whether the database knows that each replacement means a separate deposit. Now set **both** transactions to REPEATABLE READ before BEGIN, retaining the same order and reads inside the transactions. Predict what changes. Choose a repair and explain exactly where its protection starts and ends.

<details>
<summary>Check your reasoning</summary>

**Result:** both writes succeed and both transactions commit at READ COMMITTED and REPEATABLE READ. The asserted balance is 110 in each schedule.

**Decisive reasoning:** B sends the saved 100 plus 10 as a literal 110. InnoDB's UPDATE acts on the current target row; B's earlier consistent-read snapshot does not convert the replacement into an increment or reject it merely for staleness.

**Plausible wrong answer:** “REPEATABLE READ must reject B with the same conflict as PostgreSQL.” Isolation names do not supply identical operation behavior across engines. Another wrong answer is 120: neither UPDATE instructs the database to add to the current balance.

**Repair:** use `balance = balance + 10` for this additive intent. Alternatively, both writers must use SELECT FOR UPDATE **before** computing, then save and commit in the same explicit transaction. The [asserted repair schedules](/mysql/05-patterns/fixing-lost-updates) show B waiting, then using A's committed 110, with a final balance of 120.

**Limits:** simply putting BEGIN around the existing ordinary read and replacement is already what this schedule does. A stale literal writer outside the chosen protocol can still overwrite work. Locks can wait or deadlock, and the application must handle failures. Single-row deposit repairs do not by themselves protect cross-row rules or external effects.

**Evidence and optional replay:** [the complete asserted schedules](/mysql/02-isolation/lost-update). After [local setup](/about/run-locally), run these one at a time:

```sh
bun lesson mysql/02-isolation/lost-update-read-committed
bun lesson mysql/02-isolation/lost-update-repeatable-read
bun lesson mysql/05-patterns/fix-lost-update-for-update
```

</details>

## An editing interval

A document starts as `Original`, version 1. Both editors load it in standalone reads, then spend time editing with no open transaction. A starts a REPEATABLE READ save transaction, replaces the body with `A edit`, advances the version to 2, and commits. B then starts its own REPEATABLE READ save transaction and sends:

```sql
UPDATE documents
SET body = 'B edit', version = version + 1
WHERE id = 1 AND version = 1;
```

Predict the affected-row count and the stored body/version. Explain what B should tell its user. Would replacing version 1 with the latest version and blindly resending `B edit` satisfy a rule that a newer edit must not be silently overwritten? Explain why this UPDATE differs from the earlier deposit replacement.

<details>
<summary>Check your reasoning</summary>

**Result:** B affects zero rows. After B rolls back, a fresh read still returns `A edit`, version 2. The replay then deliberately demonstrates the failed repair: substituting version 2 while retaining B's old draft writes `B edit`, version 3.

**Decisive reasoning:** the current target does not match the version B loaded. The UPDATE now includes a revision condition, unlike the earlier unconditional replacement. Advancing the version on success changes the row, so changed-row and matched-row client reporting both distinguish success from this unmatched predicate.

**Plausible wrong answer:** “MySQL accepts stale replacements, so B must overwrite A here too.” The stale version predicate fails to match. Another wrong repair is fetching version 2 and blindly replaying B's text, which can erase A's edit.

**Repair:** keep B's draft, roll back the failed save, and fetch current state. Ask the user or application to reconsider or reconcile the edits before attempting a new checked save. Every replacement writer must check and advance the version.

**Limits:** deletion can also produce zero rows. The count alone does not diagnose the cause, and the UPDATE can wait or fail. This is database conflict evidence, not an executed editor UI or merge policy. Replaying an additive deposit after fresh reads is a different application decision from replacing a human edit.

**Evidence and optional replay:** [checked document replacement](/mysql/05-patterns/checked-writes#an-editing-interval), and [affected-row settings](/mysql/05-patterns/fixing-lost-updates#fix-3-optimistic-locking-with-a-version-column). After [local setup](/about/run-locally):

```sh
bun lesson mysql/05-patterns/stale-edit
```

</details>

Continue with the [protection-choice guide](/concepts/protection-choices), or try [the PostgreSQL practice](/postgres/02-isolation/practice-two-writers) before reading its answers.
