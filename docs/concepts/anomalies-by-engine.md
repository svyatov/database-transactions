---
description: "Operation-scoped PostgreSQL and MySQL anomaly comparison, separating asserted schedules, documented contracts, and unexecuted derivations."
---

# Anomalies by engine

The same isolation name does not imply the same operation contract. This comparison concerns PostgreSQL 18 and MySQL 8.4 InnoDB transactional tables, under the transaction boundaries in the linked lessons. Own writes, sequences, stale values read outside the protected transaction, and external effects require separate scope.

**D** is a demonstrated asserted schedule, not all executions. **M** is a Documented contract in the linked engine catalog/manual. **†** is an Entailed guarantee without a direct Scenario at that level. Its derivation is in the linked catalog's “How to use this table” section. The comparison preserves every reference topic, including unexecuted predicate and read-only variants.

Each row states the weakest relevant exclusion for its specified operation, not one universal ladder for all SQL. PostgreSQL accepts READ UNCOMMITTED as READ COMMITTED; InnoDB has a distinct READ UNCOMMITTED implementation.

| Code | Anomaly or operation | PostgreSQL | MySQL InnoDB |
|---|---|---|---|
| G0 | Overwrite an uncommitted target | M: target row locks at every level; D: [RC wait](/postgres/02-isolation/anomaly-catalog#dirty-writes-g0) | † target locks at every level; D: [RU wait](/mysql/02-isolation/anomaly-catalog#dirty-writes-g0) |
| G1a | Read concurrent uncommitted table changes | M: excluded at every level; D: [RU alias](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | M: excluded from RC; D: [dirty RU value](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) |
| G1b | Intermediate draft read | † excluded at every level; D: [RC example](/postgres/02-isolation/anomaly-catalog#intermediate-reads-g1b) | † excluded from RC; D: [RU/RC examples](/mysql/02-isolation/anomaly-catalog#intermediate-reads-g1b) |
| G1c | Cycle through dirty cross-reads | † excluded at every level; D: [RC example](/postgres/02-isolation/anomaly-catalog#circular-information-flow-g1c) | † excluded from RC; D: [RU/RC examples](/mysql/02-isolation/anomaly-catalog#circular-information-flow-g1c) |
| OTV | Committed rows hidden by an uncommitted overwrite | † excluded at every level; D: [RC example](/postgres/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv) | † excluded from RC; D: [RU/RC examples](/mysql/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv) |
| P2 | Repeated plain consistent SELECT after a concurrent commit | M: excluded at RR; D: [stable rows](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | M: excluded for consistent SELECTs at RR; D: [stable rows](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms) |
| G-single | Read skew | † excluded between RR plain reads without own modifications; D: [RC/RR totals](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed) | † excluded between RR consistent reads without own modifications; D: [totals](/mysql/02-isolation/read-committed#read-skew-a-total-that-never-existed); mixed [DELETE/SELECT](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds) differs; † SERIALIZABLE participating locks |
| PMP | Changed matching set after a concurrent commit | M: excluded for RR plain reads; D: [new row excluded](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | M: excluded for RR consistent SELECTs; current DML can reach post-snapshot rows; † SERIALIZABLE retained range locks, [derivation](/mysql/02-isolation/anomaly-catalog#how-to-use-this-table) |
| P4 | Read and stale literal write inside the shown transaction | M: RR changed-target rejection; D: [40001 and fresh retry](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error) | D: [loss at RC/RR](/mysql/02-isolation/lost-update); † SERIALIZABLE retained read locks, [derivation](/mysql/02-isolation/anomaly-catalog#how-to-use-this-table), no direct P4 execution at that level |
| G2-item | On-call count and different-row writes | M: SERIALIZABLE serial equivalence; D: [RR loss and B's rejection](/postgres/02-isolation/serializable#the-same-interleaving-serializable) | † SERIALIZABLE rule protection; D: [RR loss and B's 1213](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |
| G2 | Predicate variant beyond the on-call schedule | M: SERIALIZABLE serial equivalence; no predicate Scenario here, [catalog](/postgres/02-isolation/anomaly-catalog#how-to-use-this-table) | † SERIALIZABLE participating range locks; no predicate Scenario here, [derivation](/mysql/02-isolation/anomaly-catalog#how-to-use-this-table) |
| Fekete example | Read-only report anomaly | M: SERIALIZABLE serial equivalence; D: [RR results and SERIALIZABLE cashier rejection](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) | Not catalogued or executed here |

† Every derived cell above lacks a direct execution of its universal exclusion. Exclusive target locks exclude dirty overwrites; excluding concurrent uncommitted versions excludes intermediate drafts and dirty cross-reads/OTV. A stable consistent snapshot excludes intervening commits between those reads, provided own changes do not alter the observed rule. Retained SERIALIZABLE read/range locks prevent competing writers invalidating protected reads/predicates before the transaction ends. These are the catalogs' explicit derivations, not stronger-level guarantees inferred from a single weaker-level run.

A cycle with both old reads can still lack a serial ordering at READ COMMITTED; excluding a dirty-read cycle is not serializability. A read-skew guarantee for consistent SELECTs is not a guarantee for mixed current DML and snapshot reads.

## What the P4 row is telling you

PostgreSQL REPEATABLE READ rejects the demonstrated post-snapshot changed target; the successful fresh retry is a separate asserted branch. InnoDB REPEATABLE READ permits the shown stale literal write. Neither result protects values read outside the transaction or nonparticipating writers. [Single-row protocols](/mysql/05-patterns/fixing-lost-updates) offer alternative scoped repairs.

SERIALIZABLE protects a rule only when every relevant writer participates and each transaction preserves it in serial execution. InnoDB standalone autocommit reads do not retain the explicit-transaction protection. Conflicts can wait, fail, or succeed. Recovery must repeat fresh reads and decisions under a bound, or return controlled failure; no successful commit or external deduplication is automatic.

## The full breakdown

- [PostgreSQL catalog](/postgres/02-isolation/anomaly-catalog): every reference cell and its D/M/† support, with unexecuted variants stated.
- [MySQL catalog](/mysql/02-isolation/anomaly-catalog): consistent/current scope, explicit SERIALIZABLE participation, and unexecuted variants.
- [Hermitage](https://github.com/ept/hermitage): a separate suite. Neither project catalog claims complete execution coverage of it.
