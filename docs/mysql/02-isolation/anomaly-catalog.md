# The anomaly catalog

This catalog distinguishes executed schedules on **MySQL 8.4.11, InnoDB** from
broader [MySQL 8.4 contracts](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html).
The [concept catalog](/concepts/isolation-anomalies) defines the names. The examples
concern transactional table rows, with isolation and transaction boundaries shown
in their SQL. They do not establish full Hermitage coverage.

**D** means Demonstrated behavior: the linked Scenario executes and asserts that
particular schedule, not all schedules. **M** means a Documented contract in the
named manual sections below. **†** means an Entailed guarantee without a direct
execution at that level, with its derivation in [How to use this table](#how-to-use-this-table).
Own writes, mixed current/snapshot reads, and nontransactional effects need separate scope.

| Code | Anomaly or operation | READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ, default | SERIALIZABLE |
|---|---|---|---|---|---|
| G0 | Overwrite before the prior writer ends | D: [second writer waits](#dirty-writes-g0); † | † row locks | † row locks | † row locks |
| G1a | Dirty read of a concurrent table change | D: [999 then rollback](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) | M: excluded | M: excluded | M: excluded |
| G1b | Intermediate read | D: [draft 999](#intermediate-reads-g1b) | D: [draft 555 excluded](#intermediate-reads-g1b); † | † | † |
| G1c | Cycle through dirty cross-reads | D: [both new values, both commit](#circular-information-flow-g1c) | D: [old values](#circular-information-flow-g1c); † dirty cycle excluded | † dirty cycle excluded | † dirty cycle excluded |
| OTV | Committed rows hidden by an uncommitted overwrite | D: [12/19 split view](#observed-transaction-vanishes-otv) | D: [draft excluded](#observed-transaction-vanishes-otv); † | † | † |
| P2 | Non-repeatable consistent SELECT from concurrent commit | Not executed here | D: [100 then 200](/mysql/02-isolation/read-committed#non-repeatable-reads) | M: excluded; D: [stable values](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms) | M: excluded in one transaction |
| G-single | Read skew across separate consistent SELECTs | Not executed here | D: [125 total](/mysql/02-isolation/read-committed#read-skew-a-total-that-never-existed) | D: [100 total](/mysql/02-isolation/read-committed#read-skew-a-total-that-never-existed); † consistent reads; D: [mixed DELETE/SELECT](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds) | † participating transaction |
| PMP | Phantom from concurrent commit | Not executed here | D: [new matching row](/mysql/02-isolation/read-committed#phantoms) | M: excluded for consistent SELECTs; M: current DML can reach post-snapshot rows | † locking range in one transaction |
| P4 | In-transaction read-modify-write | Not executed here | D: [110 instead of 120](/mysql/02-isolation/lost-update#at-read-committed) | D: [110 instead of 120](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you) | † retained read locks; not executed here |
| G2-item | On-call count and separate-row writes | Not executed here | Not executed here | D: [both commit, count zero](/mysql/02-isolation/serializable#write-skew-at-repeatable-read) | D: [B rejected, count one](/mysql/02-isolation/serializable#serializable-stops-it-with-locks); † rule protection |
| G2 | Predicate serialization anomaly beyond this on-call schedule | Not executed here | Not executed here | Not executed here; M: snapshot and current reads differ | † locking ranges for participating transactions; no predicate schedule here |

## How to use this table

The M cells use MySQL 8.4's [level descriptions](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
and [consistent-read contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html).
READ COMMITTED and REPEATABLE READ consistent SELECTs exclude concurrent uncommitted
versions, while own earlier writes remain visible. REPEATABLE READ retains the first
consistent-read snapshot. Current UPDATE, DELETE and locking reads use different
visibility. None of those rules makes every statement a snapshot read.

The † cells are explicit derivations, not executions at every level:

- G0: the [exclusive locks on UPDATE targets](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
  prevent a second writer overwriting an uncommitted target. This does not prevent
  every dependency cycle or define dirty writes by a mixed final state.
- G1b and dirty-read G1c: excluding uncommitted versions excludes intermediate drafts
  and the dirty cross-reads that form this cycle. It does not exclude every read/write
  dependency cycle at READ COMMITTED; both old reads can still lack a serial order.
- OTV: a consistent read selects committed versions, so an uncommitted overwrite
  cannot hide the preceding committed version. Separate READ COMMITTED statements
  have different snapshots; a later committed partial overwrite can change one row.
- Read skew: one REPEATABLE READ snapshot excludes intervening concurrent commits
  between consistent SELECTs when the reader does not modify the observed data.
  SERIALIZABLE retained shared locks likewise prevent a writer from invalidating
  those reads before the transaction ends.
- SERIALIZABLE PMP, P4, and G2: [locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
  retain shared locks in the explicit transaction, and the
  [index-range rules](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
  protect scanned predicates against conflicting changes/inserts. Competing writes
  must wait or an attempt must fail rather than both silently invalidating the
  protected decisions. Every relevant operation must be inside the participating
  transaction; standalone autocommit reads do not retain this protection.
  A business rule additionally requires each serial transaction to preserve it.

The [SERIALIZABLE Scenario](/mysql/02-isolation/serializable) demonstrates both explicit
BEGIN locking and the standalone autocommit exception. It does not execute every
predicate schedule, prove all catalog cells by repetition, or test stale reads made
outside a protected transaction. A schedule's absence in one run is not impossibility.

## The MySQL-specific pattern

REPEATABLE READ consistent SELECTs exclude later concurrent commits, but current
DML and own writes can change what the transaction subsequently sees. The
[lost-update examples](/mysql/02-isolation/lost-update) commit stale literal writes
at both READ COMMITTED and REPEATABLE READ. This does not mean isolation can never
protect a read-modify-write operation: explicit SERIALIZABLE transactions lock reads.
Choose a protection with the transaction boundary and writer participation stated.

## What READ UNCOMMITTED really costs

These schedules demonstrate particular dirty reads and a blocked competing write.
The all-level exclusions above use contracts and marked derivations separately.

### Dirty writes (G0)

B's first UPDATE waits for A to commit. Both of B's final prices are asserted in
this order of execution. An uncommitted overwrite is the dirty-write event;
interleaving or a mixed final state alone is not its definition.

<!--@include: ./parts/dirty-write.md-->

### Intermediate reads (G1b)

B reads draft 999 at READ UNCOMMITTED before A replaces it with committed 110.
In the READ COMMITTED repeat, B reads 110 while A's draft 555 is uncommitted.
This repeat does not claim to read 100 and then 110 at READ COMMITTED.

<!--@include: ./parts/intermediate-read.md-->

### Circular information flow (G1c)

At READ UNCOMMITTED, both read the other's uncommitted new value and both commit:
neither serial order produces both observations. After resetting the balances,
READ COMMITTED excludes those dirty values. Both see 100 and both commit, a different
dependency cycle that is still not serial-equivalent. No serializability claim is
made for READ COMMITTED.

<!--@include: ./parts/circular-information-flow.md-->

### Observed transaction vanishes (OTV)

C's READ UNCOMMITTED SELECT returns 12 from B's draft and 19 from A's commit.
The READ COMMITTED repeat excludes A's uncommitted 51/59, then includes both after
commit. These returned rows illustrate the stated split-view operation; the project
does not claim the complete formal Hermitage suite or permanent visibility of a
committed transaction's original values.

<!--@include: ./parts/observed-transaction-vanishes.md-->

## Error codes to retry on

The [InnoDB error-handling contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)
distinguishes rollback scope. Do not retry based on a code without checking the
transaction state and application decision.

| errno | SQLSTATE | Scope and next action | Evidence |
|---|---|---|---|
| 1213 | 40001 | Entire transaction rolled back; retry fresh reads/decisions or return controlled failure | D: [SERIALIZABLE schedule](/mysql/02-isolation/serializable); M: error handling |
| 1205 | HY000 | Waiting statement rolled back by default; entire transaction with innodb_rollback_on_timeout=ON | M: error handling; separate [locking lesson](/mysql/03-locking/nowait-skip-locked) |

These are not the only possible statement or connection errors. Neither retry
success nor a particular deadlock victim is guaranteed. Deadlock detection can be
[disabled](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html),
and this audit does not execute the timeout configuration alternatives.

## Further reading

- [Hermitage](https://github.com/ept/hermitage): separate runnable isolation tests
- [Anomalies by engine](/concepts/anomalies-by-engine)
- [The same catalog for PostgreSQL](/postgres/02-isolation/anomaly-catalog)
