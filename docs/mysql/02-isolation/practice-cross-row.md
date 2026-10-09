---
description: Predict two InnoDB schedules for a shared staffing rule, then justify a protection and its limits.
---

# Practice: a staffing decision

Use MySQL 8.4.11 with InnoDB tables and deadlock detection enabled. Work on paper before opening either answer. No installation is needed. Each exercise starts independently with Alice and Bob on call. The business rule is that at least one doctor must remain on call. Each request may remove its own doctor only when its count is greater than one.

## Two requests

Set both sessions to REPEATABLE READ before BEGIN. Their count queries are ordinary SELECTs. Here is the schedule up to the commit attempts:

| Step | A | B |
| --- | --- | --- |
| 1 | Set REPEATABLE READ; BEGIN | |
| 2 | | Set REPEATABLE READ; BEGIN |
| 3 | `SELECT count(*) AS on_call FROM doctors WHERE on_call` | |
| 4 | | The same count SELECT |
| 5 | `UPDATE doctors SET on_call = false WHERE name = 'alice'` | |
| 6 | | `UPDATE doctors SET on_call = false WHERE name = 'bob'` |
| 7 | Attempt COMMIT | |
| 8 | | Attempt COMMIT |

Predict both counts, whether either UPDATE waits for the other, both commit responses, and the committed on-call count afterward. Explain whether writing different primary-key rows is enough to preserve the rule. Choose a repair that covers all participating writers and state what its application must do on conflict.

<details>
<summary>Check the two requests</summary>

**Result:** both reads return 2, neither UPDATE waits for the other, both commit, and the final asserted count is 0.

**Decisive reasoning:** the nonlocking reads each see both doctors. The UPDATEs use current targets, but each only changes its own row. Neither UPDATE recomputes the earlier aggregate decision. A depended on Bob remaining on call; B depended on Alice remaining on call.

**Plausible wrong answer:** “Current reads refresh the count, so B cannot remove the last doctor.” The UPDATE is not the earlier count query. Another wrong answer is that separate-row writes automatically preserve a cross-row rule.

**Repair:** make the count, decision, conditional removal, and commit one explicit SERIALIZABLE transaction for every writer that can reduce this staffing set. Handle transaction failures by repeating all reads and decisions with a bound, or return a controlled failure. The next exercise examines this protocol.

**Limits:** a writer that bypasses the count can break the rule even when it runs alone. Locking only each request's own doctor does not coordinate the shared decision. Separate autocommit statements do not create this protected boundary. This exercise measures no cost comparison or external effects.

**Demonstrated behavior and evidence:** [the complete asserted REPEATABLE READ schedule](/mysql/02-isolation/serializable#write-skew-at-repeatable-read). The PostgreSQL [dependency explanation](/postgres/02-isolation/serializable#the-same-interleaving-serializable) also explains the ordering of these old reads; it does not claim that InnoDB implements SSI.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson mysql/02-isolation/write-skew-rr`.

</details>

## A different transaction boundary

Reset both doctors to on call. Set **both** sessions to SERIALIZABLE before their explicit BEGINs. Both run the count SELECT before either tries an UPDATE. Send A's UPDATE first. If it has not completed, leave it pending and send B's UPDATE. After the responses, commit the attempt that can continue. Handle the other attempt's response, then start its fresh SERIALIZABLE transaction and repeat the count and greater-than-one decision before commit.

Predict the count results, which statement first waits, what happens when B sends its UPDATE, the remaining count after the first committed attempt, and the fresh request's decision. Explain what each session holds and requests. Would setting SERIALIZABLE while leaving the count and UPDATE as separate autocommit statements provide the same boundary?

<details>
<summary>Check the different boundary</summary>

**Result:** both counts return 2. A's UPDATE waits. B's UPDATE fails with `1213` in this schedule, rolling back B's transaction; A's UPDATE then completes and A commits. The remaining count is 1. A fresh B attempt sees 1 and declines to remove Bob. Alice is off call and Bob remains on call.

**Decisive reasoning:** the explicit SERIALIZABLE count reads hold shared locks covering both rows. A needs an exclusive lock on Alice but B holds a shared lock there. B needs an exclusive lock on Bob but A holds a shared lock there. The cycle is resolved by enabled deadlock detection. After the rollback, the fresh request makes a new decision.

**Plausible wrong answer:** “Both writes use different rows, so neither waits.” Their earlier read locks overlap. Another wrong answer is that a session-level isolation setting alone combines separate autocommit statements into this transaction.

**Repair:** keep count, decision, and change inside one explicit SERIALIZABLE transaction and coordinate every relevant writer. On deadlock, restart the whole transaction with fresh reads and decisions under a bounded policy, or return controlled failure. A fresh count of 1 is a business refusal to leave.

**Limits:** the detector's victim is not universal. Timeouts have their own rollback scope; do not assume every wait error rolls back the entire transaction. Standalone autocommit SERIALIZABLE SELECTs can be nonlocking consistent reads. Nonparticipating writers defeat the protocol, and retries can fail again.

**Evidence:** [the asserted locking schedule, retry, and autocommit comparison](/mysql/02-isolation/serializable#serializable-stops-it-with-locks), the [lock-wait explanation](/mysql/02-isolation/serializable#serializable-stops-it-with-locks), and the [worked decision](/concepts/protection-choices). The [MySQL 8.4 contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_serializable) states that, with autocommit disabled, plain SELECTs become SELECT FOR SHARE. The linked lesson also qualifies explicit transactions and standalone autocommit reads.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson mysql/02-isolation/write-skew-serializable`.

</details>
