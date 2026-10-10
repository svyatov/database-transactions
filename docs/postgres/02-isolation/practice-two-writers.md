---
description: Predict two PostgreSQL schedules, explain each decision, and justify a repair before opening the answers.
---

# Practice: two writers

Work on paper first. No installation is needed. Use PostgreSQL 18.6 and the stated transaction boundaries. Write your prediction and its reason before opening each answer.

## Two deposits

One account starts at 100. Each client intends to deposit 10. Each saves the value returned by its SELECT and computes a literal replacement in application code.

| Step | A | B |
| --- | --- | --- |
| 1 | BEGIN at READ COMMITTED; SELECT balance, save 100 | |
| 2 | | BEGIN at READ COMMITTED; SELECT balance, save 100 |
| 3 | UPDATE balance = 110; COMMIT | |
| 4 | | UPDATE balance = 110; then attempt COMMIT |

Predict B's UPDATE response and the final committed balance. Explain whether the database knows that each replacement means a separate deposit. Now change **both** transactions to REPEATABLE READ, retaining the same order and reads inside the transactions. Predict what changes. If B encounters a conflict, decide which earlier steps its repair must repeat, and why merely resending 110 is insufficient.

<details>
<summary>Check your reasoning</summary>

**Result:** at READ COMMITTED both writes succeed, leaving 110. At REPEATABLE READ B's UPDATE fails with `40001`; only A's 110 is committed at that point. B must ROLLBACK before starting fresh work. The replay then rereads 110 in a new transaction, computes 120, and commits it.

**Decisive reasoning:** the literal 110 carries no instruction to add 10 to the current balance. At READ COMMITTED B replaces the row after A has committed. At REPEATABLE READ B's snapshot was established before A changed the target, so this UPDATE is refused.

**Plausible wrong answer:** “The two transactions each add 10, so the balance must be 120.” They each send a replacement of 110. Another wrong answer is to treat `40001` as a completed deposit: it rejects B's attempted change.

**Repair:** for this additive intent, use `balance = balance + 10`, or lock before reading and computing in one short transaction. A fresh whole-transaction retry is appropriate for the demonstrated REPEATABLE READ conflict: repeat reads and decisions, not just the old UPDATE.

**Limits:** the [three repair protocols](/postgres/05-patterns/fixing-lost-updates) require cooperating writers. An unrelated stale replacement can still overwrite a relative increment. A conflict retry needs a bound and controlled failure; this one successful retry is not a guarantee that all schedules succeed. None of these single-row examples protects an external effect or a cross-row rule.

**Evidence and optional replay:** [the complete asserted schedules](/postgres/02-isolation/lost-update) include the intermediate 110 and fresh retry to 120. After [local setup](/about/run-locally), run these one at a time:

```sh
bun lesson postgres/02-isolation/lost-update-read-committed
bun lesson postgres/02-isolation/lost-update-repeatable-read
bun lesson postgres/05-patterns/fix-lost-update-atomic
```

</details>

## An editing interval

A document starts as `Original`, version 1. Both editors load it in standalone reads, then spend time editing with no open transaction. A starts a READ COMMITTED save transaction, replaces the body with `A edit`, advances the version to 2, and commits. B then starts its own READ COMMITTED save transaction and sends:

```sql
UPDATE documents
SET body = 'B edit', version = version + 1
WHERE id = 1 AND version = 1;
```

Predict the affected-row count and the stored body/version. Explain what B should tell its user. Would replacing version 1 with the latest version and blindly resending `B edit` satisfy a rule that a newer edit must not be silently overwritten? Does PostgreSQL's earlier REPEATABLE READ result cover a value loaded outside the save transaction?

<details>
<summary>Check your reasoning</summary>

**Result:** B affects zero rows. After B rolls back, a fresh read still returns `A edit`, version 2. The replay then deliberately demonstrates the failed repair: substituting version 2 while retaining B's old draft writes `B edit`, version 3.

**Decisive reasoning:** B explicitly checks the revision it edited. The current row no longer matches version 1. The earlier in-transaction REPEATABLE READ conflict does not establish protection for a value loaded before the save transaction.

**Plausible wrong answer:** “Fetch version 2 and retry B's text automatically.” That bypasses the check's purpose and can erase A's work without reconsidering it.

**Repair:** retain B's draft, refresh the document, and ask the user or application to reconcile the edits before attempting a new checked save. All replacement writers must check the version and advance it on success.

**Limits:** zero rows can also mean deletion. Inspect current state after rollback rather than treating the count as a complete diagnosis. The UPDATE can still wait or fail. This executes the database conflict boundary; it does not test an editor UI, automatic merging, or a user's decision.

**Evidence and optional replay:** [checked document replacement](/postgres/05-patterns/checked-writes#an-editing-interval). After [local setup](/about/run-locally):

```sh
bun lesson postgres/05-patterns/stale-edit
```

</details>

Continue with the [protection-choice guide](/concepts/protection-choices), or try [the MySQL practice](/mysql/02-isolation/practice-two-writers) before reading its answers.
