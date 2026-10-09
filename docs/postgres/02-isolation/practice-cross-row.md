---
description: Predict two PostgreSQL schedules for a shared staffing rule, then justify a protection and its limits.
---

# Practice: a staffing decision

Use PostgreSQL 18.6. Work on paper before opening either answer. No installation is needed. Each exercise starts independently with Alice and Bob on call. The business rule is that at least one doctor must remain on call. Each request may remove its own doctor only when its count is greater than one.

## Two requests

Both sessions begin explicit REPEATABLE READ transactions. Their count queries are ordinary SELECTs. Here is the schedule up to the commit attempts:

| Step | A | B |
| --- | --- | --- |
| 1 | `BEGIN ISOLATION LEVEL REPEATABLE READ` | |
| 2 | | `BEGIN ISOLATION LEVEL REPEATABLE READ` |
| 3 | `SELECT count(*)::int AS on_call FROM doctors WHERE on_call` | |
| 4 | | The same count SELECT |
| 5 | `UPDATE doctors SET on_call = false WHERE name = 'alice'` | |
| 6 | | `UPDATE doctors SET on_call = false WHERE name = 'bob'` |
| 7 | Attempt COMMIT | |
| 8 | | Attempt COMMIT |

Predict both counts, whether either UPDATE waits for the other, both commit responses, and the committed on-call count afterward. Explain whether writing different primary-key rows is enough to preserve the rule. Choose a repair that covers all participating writers and state what its application must do on conflict.

<details>
<summary>Check the two requests</summary>

**Result:** both reads return 2, neither UPDATE waits for the other, both commit, and the final asserted count is 0.

**Decisive reasoning:** each decision uses a snapshot containing both doctors. Each UPDATE changes a different row. A's count relied on Bob staying on call, while B's count relied on Alice staying on call. Checking for a conflicting write to the same row does not protect those dependencies.

**Plausible wrong answer:** “The second UPDATE must fail because REPEATABLE READ rejects stale updates.” That rejection concerns a target changed since the snapshot. The other writer changes a different target here. Stable counts do not establish a safe combined decision.

**Repair:** make the count, decision, conditional removal, and commit one SERIALIZABLE transaction for every writer that can reduce this staffing set. On `40001`, roll back and retry the whole request with fresh reads and decisions, with a bound, or return a controlled failure. The next exercise examines this protocol.

**Limits:** a writer that bypasses the count can break the rule even when it runs alone. A retry can conflict again. Locking only each request's own doctor does not coordinate the shared decision. Other suitable coordination protocols require their own design; this exercise measures no cost comparison or external effects.

**Demonstrated behavior and evidence:** [the complete asserted REPEATABLE READ schedule](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew). The [SERIALIZABLE explanation](/postgres/02-isolation/serializable#the-same-interleaving-serializable) explains the ordering, rather than observing SSI internals.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/write-skew-rr`.

</details>

## A different transaction boundary

Reset both doctors to on call. Use the same first six steps, but begin **both** transactions at SERIALIZABLE. A attempts COMMIT first, then B attempts COMMIT. After handling its response, B begins a fresh SERIALIZABLE transaction, repeats the count, applies the same greater-than-one decision, and attempts COMMIT.

Predict the first two commit responses for this exact schedule, the fresh count, B's decision, and the final named doctors' status. Explain the logical ordering required by each old read. Does the isolation contract always select the same rejected session or the same failure statement?

<details>
<summary>Check the different boundary</summary>

**Result:** A commits; B's first COMMIT fails with `40001`. B's fresh read returns 1, so it declines to remove Bob and commits without that change. Alice is off call and Bob remains on call.

**Decisive reasoning:** A read Bob before B's removal, requiring A before B in a serial explanation. B read Alice before A's removal, requiring B before A. Both requirements cannot hold. PostgreSQL SSI rejects this execution without the count SELECTs taking blocking row locks.

**Plausible wrong answer:** “Different written rows mean both SERIALIZABLE transactions must commit.” SERIALIZABLE also monitors dependencies involving reads. Another wrong answer is that retrying only B's old UPDATE is sufficient: its old count is not a new decision.

**Repair:** discard the aborted attempt, repeat the entire transaction with fresh reads, and honor the new count. Treat a count of 1 as a business refusal to leave, rather than a reason to retry until the removal happens. Keep effects outside the database out of a blindly repeated body.

**Limits:** this Scenario asserts B's failure at COMMIT, not a universal victim or failure point. Ordinary conflicting writes and explicit locks can still wait. All relevant writers must preserve the rule in serial execution. A successful retry and a particular retry count are not guaranteed.

**Evidence:** [the asserted SERIALIZABLE schedule and fresh attempt](/postgres/02-isolation/serializable#the-same-interleaving-serializable). The [PostgreSQL 18 contract](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE) says it “emulates serial transaction execution for all committed transactions”. The [worked decision](/concepts/protection-choices) states the participation boundary.

**Optional replay:** after [local setup](/about/run-locally), run `bun lesson postgres/02-isolation/write-skew-serializable`.

</details>
