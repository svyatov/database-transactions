# Shared claims and full-audit reconciliation, issue #40

This existing-content audit implements [#40](https://github.com/svyatov/database-transactions/issues/40) under [#31](https://github.com/svyatov/database-transactions/issues/31). Its fixed point is `d35d30d0e4542cfb691042b4f49b124c1b245c8a`. It adds no exercise, worked protection decision, Mechanism diagram, failure lab, delivery integration, or alternative harness. The complete temporary coverage inventories, exact source snapshots, predecessor inventories, and raw evidence are retained for assessment. The issue completion summary identifies checked commits, counts, and QA results without requiring a private path.

## Complete published surface

The surface enumeration covers all tracked documentation pages, shared Vue components, site configuration and derived metadata, generated Transcript/timeline fragments, public assets, llms indexes, ledger fields, Scenario sources, CLI explanations, README, package description, glossary, and contribution evidence policy. Contributor pages and historical audit records built by VitePress are included. Binary icons and styling are explicitly classified as nonbehavioral assets, not silently omitted. Existing chapter navigation and all advanced reference topics remain available.

Coverage units preserve exact file/line text, all table columns including the final column, nested YAML fields with step indices, and the unique Scenario identity of generated mirrors. Whole-file hashes and retained bytes make repeated claims reviewable. These are inclusive occurrence counts, not counts of independent guarantees or proof that every line was manually re-reviewed. Semantic support is assessed by the decisions below and the attributed chapter decisions, separately from mechanical correspondence checks.

The two unchanged engine catalogs retain unexecuted variants and D/M/† support. The shared comparison now separates G2-item from unexecuted predicate G2, consistent SELECT exclusions from mixed current operations, and PostgreSQL's read-only demonstration from MySQL's uncatalogued case. A stable generated mirror is not additional evidence over all schedules.

## Eight chapter slices

| Slice | Retained support and complete current scope |
|---|---|
| #32 | [PostgreSQL basics/isolation audit](./32-postgres-basics-isolation): nine lessons, 22 Scenarios, their complete mirrors, and all catalog cells |
| #33 | [MySQL basics/isolation audit](./33-mysql-basics-isolation): nine lessons, 21 YAML Scenarios, mirrors and catalog cells |
| #34 | [PostgreSQL locking/MVCC audit](./34-postgres-locking-mvcc): twelve lessons, seventeen Scenarios, mirrors, and manual-only wraparound |
| #35 | [Reconstructed MySQL locking/MVCC coverage](#mysql-locking-and-mvcc-reconstruction): eleven lessons, sixteen YAML Scenarios, mirrors, and manual-only purge |
| #36 | [PostgreSQL patterns/distributed audit](./36-postgres-patterns-distributed): eleven lessons, fifteen Scenarios and complete mirrors |
| #37 | [MySQL patterns/distributed audit](./37-mysql-patterns-distributed): ten lessons, fourteen Scenarios and complete mirrors |
| #38 | [PostgreSQL pitfalls/production audit](./38-postgres-pitfalls-production): eight lessons, six YAML Scenarios, thirteen compendium entries, alerts, triage, and mirrors |
| #39 | [MySQL pitfalls/production audit](./39-mysql-pitfalls-production): seven lessons, five YAML Scenarios, fifteen compendium entries, alerts, triage, and mirrors |

The union is 77 engine lesson/reference pages and 116 Scenarios: 110 shared YAML and six TypeScript client-code Scenarios. Each Scenario has one generated part, one ledger record, and one complete llms section. Lesson descriptions and structured metadata derived from lead claims keep the same Scenario identity. Reference-only pages are retained with their documented scope.

Original #32-#34 inventories and available #37-#39 temporary inventories are preserved in their native schemas, not flattened into invented operation correspondences. Older #35/#36 temporary inventories are no longer available. Their exact baseline and merged source occurrences are reconstructed from immutable Git trees, explicitly labelled as reconstruction, and combined with this run's complete current inventories. This recovers coverage and original text, not old execution logs or original metadata. The predecessor issue summaries remain the source of their historical QA attribution.

## MySQL locking and MVCC reconstruction

#35's baseline is `c66e6cd836889bbc086a1c761f73497c5824468b`; its merged tree is `f0f0a006f7dd8ed19444939d94a2d2efa79f775e`. This run inspects all eleven current lessons and sixteen source/mirror families. Record-lock compatibility, query/index-dependent gap coverage, configured deadlock detection, non-FIFO scheduling, row versus metadata timeouts, explicit transaction survival with rollback-on-timeout OFF, consistent/current visibility, undo reconstruction, estimated history length, and conditional background purge retain their narrowed support. Purge has no Scenario of its own; final history length is not bytes or a completion deadline. The complete timeout Scenario asserts earlier value/lock survival, explicit rollback, and fresh retry. No in-scope promise is inferred from the standalone excerpt in the error summary.

#36's baseline is that #35 merged tree; its merged tree is `154b2207542ba51c3470128cedba35a640ad338f`. Its durable decisions plus the reconstructed originals and exact current mirrors preserve all claims, including the corrected choice of psql as the visible notification listener. Reconstruction does not claim old scratch files survived.

## Shared dispositions

| Decision | Exact surfaces and final semantic disposition |
|---|---|
| D1, evidence policy | README, homepage and metadata, methodology, Start here, contribution policy, glossary, generator indexes, CLI completion, and curriculum summary now separate asserted schedules, versioned manual contracts, and marked derivations. Database-relevant CI executes the pinned suite; prose-only builds can reuse committed evidence. Driver agreement and generation do not establish every sentence or every schedule. |
| D2, atomicity and durability | The ACID concept scopes transactional table writes, own effects, nontransactional engines, sequences, and implicit commits. CHECK failure does not establish arbitrary business consistency. Durability is configuration/storage-dependent documented support, not a server-crash execution. The former missing local CONCEPTS link is replaced by explicit public vocabulary. |
| D3, error state | FAQ and all seven error descriptions, visible answers, and derived QAPage metadata agree. PostgreSQL standalone failure ends its implicit transaction; an error inside BEGIN leaves a failed block with full or valid-savepoint recovery. InnoDB duplicate-key, deadlock, timeout OFF/ON, metadata waits, and connection loss are different boundaries. The PostgreSQL 55P03 Scenario asserts standalone retry; failed-BEGIN recovery is separately documented and illustrated by the linked statement-error/savepoint Scenarios. The PostgreSQL 57014 and MySQL 1205 full Scenarios assert their explicit-transaction recovery; their abbreviated SQL excerpts are not the full executions. |
| D4, visibility | FAQ, Start here, level overview, non-repeatable/phantom pages, and engine comparison scope consistent SELECTs, snapshot timing, own writes, updating/locking rules, and InnoDB SERIALIZABLE autocommit. MVCC is not a promise of no table/metadata waits. PostgreSQL tuple versions and InnoDB undo are distinct implementations. |
| D5, anomaly coverage | Both shared catalogs and the five anomaly pages distinguish demonstrated schedules, manual exclusions and explicit † derivations. Dirty write means overwriting an uncommitted target, not a mixed final state. Dirty-read cycles are not all dependency cycles. G2-item and predicate G2 differ. Full Hermitage execution, predicate examples, real report publication, and MySQL read-only examples are not claimed. |
| D6, stale updates | Lost-update page and FAQ state single-row writer participation, read/write transaction boundaries, stale external values, checked versions, and conflict reconsideration. Arithmetic does not defeat an unrelated stale literal writer. PostgreSQL stronger-level changed targets can fail rather than return a fresh locking read. Human edits can need reconsideration rather than an automatic retry. |
| D7, rule protection and retry | Write-skew page, comparison, FAQ, and 40001/40P01/1213 pages require each serial transaction to preserve the rule and all relevant writers to participate. Suitable alternative coordination can protect a particular rule. Detection does not promise a fixed victim, exact latency, every survivor's commit, or successful retries. MySQL errno 1213 also carries SQLSTATE 40001. External effects require their own protocol. |
| D8, queue and delivery | Shared outbox text matches both corrected engine chapters: separately committed same-database models, deliberately omitted publication, CHECK failure, and explicit relay rollback. No broker publish or real crash is observed. † derives the duplicate window from separate effect/commit boundaries; durable retention, retries, and receiver availability are additional delivery conditions. Queue selection does not prove duplicate-free external work or fairness. Notifications have no durable replay or measured relay-latency bound. |
| D9, tooling and generation | Run-local guidance names container-provided psql through Compose, Python YAML-only parity, built-in default URLs, disposable reset targets, and serial execution. The listener helper targets Compose rather than an alternate URL. Drift can originate in source, engine/configuration, driver, harness, or renderer. The contributor queue composition describes fixed assigned-xid/page/slot observations, not a throughput rate or all-VACUUM shutdown. Generated summaries are corrected at the generator before regeneration. |
| D10, shared components and C1 | The homepage's authored deadlock snippet is labelled illustrative PostgreSQL, preserving its existing decoration. Curriculum and hero text no longer promise every topic is executable proof. The provenance footer's independent-driver clause now explicitly applies to shared YAML. Its marker is a local successful check signal; selected pytest is not claimed full-suite parity. The build commit identifies the checkout, not a fresh execution timestamp. C1's shared content defect is resolved here. |

## Inherited handoffs resolved

Every handoff row from the eight slices is retained with its original report and baseline. The temporary reconciliation index records each source row, exact cited occurrences, receiving slice, current path/field family, and disposition. No inherited item is dropped because a line moved or a generated mirror repeated it.

- #32/#33 shared error, snapshot, dirty-write, catalog, retry and evidence promises resolve through D1-D7. Their later locking/pattern handoffs resolve through the named #34-#37 decisions and exact current source families.
- #34/#35 locking, queue, ORM and horizon handoffs resolve through #36-#39's narrowed decisions. Shared row-lock/error/evidence summaries resolve through D1, D3, D4, D7 and D9.
- #36/#37's queue, idempotency, modeled outbox/saga and prepared-work handoffs resolve through #38/#39 and D8. Their shared comparison and provenance items, including C1, resolve through D1, D9 and D10.
- #38/#39's production-model, timeout, deadlock, queue-composition and evidence promises resolve through D1, D3, D7-D10. Operational advice is not promoted into an alert-accuracy, performance, recovery-time or external-effect guarantee.

Earlier audit reports and original inventories remain historical records. Their baseline quotations and earlier gate-open statements describe those revisions; this reconciliation supersedes their pending shared ownership without rewriting the historical evidence. Current live explanations and generated mirrors use the final scoped sources.

## Verification and phase gate

Semantic disposition has zero intentionally unresolved current claims or inherited handoffs. This count is separate from execution, independent-driver, artifact, static-reference, and rendered-reader results. The completion summary reports each boundary with its checked commit. Missing required execution or a blocked required reader check prevents a passed full gate; mechanical inventory counts alone cannot close it.

The full real-database suite uses PostgreSQL 18.6 and MySQL 8.4.11, with reset-capable runs serialized. Independent Python checks apply to 110 YAML Scenarios only. Two generations must have no additional drift; complete mirror identity and generated changes are inspected. Types, formatting, anchors, pinned audit references, build, corrected pages/components and reference links are separate checks. Temporary inventories and raw logs remain available for the orchestrator's assessment.

No alternative-version/configuration, server crash, real external delivery, unknown COMMIT, exhaustive schedule search, production benchmark, alert-accuracy, or learner-outcome result is claimed. Code review and merge remain separate. This implementation phase stops after QA, with the issue open and no shipping.
