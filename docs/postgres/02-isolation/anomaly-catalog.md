# The anomaly catalog

This table distinguishes demonstrated schedules from broader PostgreSQL 18 contracts.
The [concept catalog](/concepts/isolation-anomalies) defines the anomaly names. The
Scenarios below run on PostgreSQL 18.6, with plain SELECTs over transactional tables
unless stated otherwise. READ UNCOMMITTED has READ COMMITTED behavior, as documented
in the [isolation manual](https://www.postgresql.org/docs/18/transaction-iso.html).

**D** means the linked Scenario executes and asserts that particular schedule, not
every possible schedule. **M** means a Documented contract in the linked PostgreSQL 18
manual. **†** means an Entailed guarantee without a direct Scenario at that level;
the derivation is in [How to use this table](#how-to-use-this-table). Own writes and
sequence operations are outside claims about concurrent table-row snapshot changes.

| Code | Anomaly or operation | READ COMMITTED | REPEATABLE READ | SERIALIZABLE |
|---|---|---|---|---|
| G0 | Dirty write, overwrite before the prior writer ends | D: [second writer waits](#dirty-writes-g0); M: row locks | † row locks | † row locks |
| G1a | Dirty read of another transaction's table change | M: excluded; D: [READ UNCOMMITTED example](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | M: excluded | M: excluded |
| G1b | Intermediate read | D: [draft excluded](#intermediate-reads-g1b); † | † | † |
| G1c | Circular information flow through dirty reads | D: [cross-reads excluded](#circular-information-flow-g1c); † | † | † |
| OTV | Committed rows hidden by an uncommitted overwrite | D: [committed versions retained](#observed-transaction-vanishes-otv); † | † | † |
| P2 | Non-repeatable plain SELECT due to concurrent commit | D: [different values](/postgres/02-isolation/read-committed#non-repeatable-reads) | M: excluded; D: [stable values](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | M: excluded |
| G-single | Read skew across separate plain SELECTs | D: [inconsistent total](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed) | D: [consistent total](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed); † | † |
| PMP | Phantom from a concurrent commit, plain SELECT | D: [new matching row](/postgres/02-isolation/read-committed#phantoms) | M: excluded in PostgreSQL; D: [new row excluded](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | M: excluded |
| P4 | In-transaction read-modify-write of a post-snapshot changed target | D: [overwrite commits](/postgres/02-isolation/lost-update#watch-a-deposit-disappear) | M: conflict; D: [40001 and fresh retry](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error) | M: same target-row conflict rule |
| G2-item | Write skew, on-call count and separate-row writes | Not executed here | D: [both commit, count zero](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew) | D: [B fails, count one](/postgres/02-isolation/serializable#the-same-interleaving-serializable); M: serial equivalence |
| G2 | Predicate-based serialization anomaly beyond this on-call schedule | Not executed here | M: serialization anomalies possible | M: excluded among committed participating transactions |
| Fekete example | Read-only report anomaly | Not executed here | D: [two receipts before third commits](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) | D: [cashier rejected](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions); M: serial equivalence |

## How to use this table

The Documented contracts come from [Table 13.1 and the level descriptions](https://www.postgresql.org/docs/18/transaction-iso.html#MVCC-ISOLEVEL-TABLE):
READ COMMITTED plain SELECTs exclude uncommitted concurrent changes; REPEATABLE READ
uses a stable snapshot plus own writes; SERIALIZABLE adds serial-equivalence monitoring.
The [row-lock manual](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
documents waits for concurrent writers and locking reads. These contracts apply to
PostgreSQL 18 and the operations specified, not every engine or every SQL function.

The † cells have no direct execution at the stated level. Their derivations are:

- G0: the documented row locks on these UPDATEs prevent overwriting an uncommitted
  target at each level, regardless of whether a later committed version can be updated.
- G1b and the dirty-read G1c cycle: excluding uncommitted versions excludes a draft
  that is replaced before commit and cross-reads of those uncommitted writes. This
  does not exclude every dependency cycle or prove serializability at READ COMMITTED.
- OTV: a plain SELECT's snapshot selects committed versions, so uncommitted overwrites
  cannot hide the earlier committed versions. Separate READ COMMITTED statements may
  use different snapshots; a later committed partial overwrite can change a subset.
- Read skew: a stable snapshot excludes intervening concurrent commits between these
  plain SELECTs. Own writes remain visible, so the guarantee assumes the reader does
  not itself change the observed accounts or mix in nontransactional effects.

An existence demonstration can show that a level permits an anomaly. Its absence in
one run cannot establish impossibility. The table does not claim full Hermitage
coverage, predicate-write-skew execution, or universal detection of stale application
values read outside the updating transaction.

For the displayed read-modify-write race, see
[fixing lost updates](/postgres/05-patterns/fixing-lost-updates). A cross-row rule needs
each serial transaction to preserve it and relevant writers to use SERIALIZABLE, or
another suitable coordination mechanism. On 40001, retry the whole transaction with
fresh reads and decisions or return a controlled failure; do not report a commit.

## The guarantees you get for free

The following executions illustrate the contracts and derivations above. They use
READ COMMITTED; statements with stronger-level guarantees in the table need their
manual support or marked derivation, not just these examples.

### Dirty writes (G0)

B's first UPDATE waits until A commits. Both transactions update both rows in the
displayed order, so the final asserted prices are B's. A mixed final state is not the
definition of a dirty write; overwriting an uncommitted write is.

<!--@include: ./parts/dirty-write.md-->

### Intermediate reads (G1b)

B reads 100 while A's draft 999 is uncommitted, then 110 after A commits its final value.
An older REPEATABLE READ snapshot could still see 100 after that commit.

<!--@include: ./parts/intermediate-read.md-->

### Circular information flow (G1c)

Neither transaction's plain SELECT reads the other's uncommitted UPDATE. Both see
100, then both writes commit. This schedule is not serializable: excluding dirty-read
cycles does not exclude the read/write dependency cycle created by those old reads.

<!--@include: ./parts/circular-information-flow.md-->

### Observed transaction vanishes (OTV)

C sees both of A's committed balances while B's overwrites remain uncommitted, then
both of B's balances after B commits. This does not promise that committed values
remain forever unchanged or that multiple statements share one snapshot.

<!--@include: ./parts/observed-transaction-vanishes.md-->

## Further reading

- [Hermitage](https://github.com/ept/hermitage): a separate collection of isolation tests
- [Anomalies by engine](/concepts/anomalies-by-engine)
- [The same catalog for MySQL](/mysql/02-isolation/anomaly-catalog)
