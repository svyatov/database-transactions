# The anomaly catalog

What each PostgreSQL isolation level does about every named anomaly, and — in the spirit of
this site — a link to the scenario that *proves* each cell. The anomalies themselves
(definitions, diagrams, and where the G-codes come from) live in
[Concepts: the anomaly catalog](/concepts/isolation-anomalies); this page is PostgreSQL's
answer sheet, covering every case [Hermitage](https://github.com/ept/hermitage) tests.
READ UNCOMMITTED is omitted: in PostgreSQL it
[behaves exactly like READ COMMITTED](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them).

**TL;DR:**

- Staying on the default (READ COMMITTED)? The whole G1 family is already impossible — but
  [lost updates are on you](/postgres/02-isolation/lost-update#watch-a-deposit-disappear).
- REPEATABLE READ gives a stable snapshot and refuses stale writes — plan to
  [retry on `40001`](#how-to-use-this-table).
- Invariants that span rows (write skew) are only automatic at SERIALIZABLE —
  [proof](/postgres/02-isolation/serializable#the-same-interleaving-serializable).

| Code | Anomaly | READ COMMITTED *(default)* | REPEATABLE READ | SERIALIZABLE |
|---|---|---|---|---|
| G0 | **Dirty write** | ✅ impossible — [proof](#dirty-writes-g0) | ✅ impossible | ✅ impossible |
| G1a | **Dirty read** (aborted read) | ✅ impossible — [proof](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | ✅ impossible | ✅ impossible |
| G1b | **Intermediate read** | ✅ impossible — [proof](#intermediate-reads-g1b) | ✅ impossible | ✅ impossible |
| G1c | **Circular information flow** | ✅ impossible — [proof](#circular-information-flow-g1c) | ✅ impossible | ✅ impossible |
| OTV | **Observed transaction vanishes** | ✅ impossible — [proof](#observed-transaction-vanishes-otv) | ✅ impossible | ✅ impossible |
| P2 | **Non-repeatable read** | ⚠️ [happens](/postgres/02-isolation/read-committed#non-repeatable-reads) | ✅ prevented — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | ✅ prevented |
| G-single | **Read skew** | ⚠️ [happens](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed) | ✅ prevented — [proof](/postgres/02-isolation/read-committed#read-skew-a-total-that-never-existed) | ✅ prevented |
| PMP | **Phantom read** | ⚠️ [happens](/postgres/02-isolation/read-committed#phantoms) | ✅ prevented in PostgreSQL — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) *(standard would allow it)* | ✅ prevented |
| P4 | **Lost update** | ⚠️ [silent](/postgres/02-isolation/lost-update#watch-a-deposit-disappear) | ✅ rejected with `40001` — [proof](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error) | ✅ rejected with `40001` |
| G2-item / G2 | **Write skew** (item & predicate) | ⚠️ possible¹ | ⚠️ [happens](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew) | ✅ rejected with `40001` — [proof](/postgres/02-isolation/serializable#the-same-interleaving-serializable) |
| — | **Read-only anomaly** (Fekete et al.) | —¹ | ⚠️ [happens](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) | ✅ rejected with `40001` — [proof](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) |

¹ These two anomalies are defined against stable snapshots. READ COMMITTED doesn't provide
snapshot stability in the first place — it's exposed to everything REPEATABLE READ is, plus
the rows themselves can shift mid-transaction (the RR scenarios are the demonstrations of the
strictly-stronger level).

## How to use this table

- Staying on the default? Then **know that lost updates are on you**: fix read-modify-write
  code with atomic updates, `FOR UPDATE`, or version columns
  ([fixing lost updates](/postgres/05-patterns/fixing-lost-updates)).
- Invariants that span multiple rows ("at least one on call", "sum must stay positive",
  "unique-ish under concurrency") are only automatic at **SERIALIZABLE** — anything less needs
  explicit locking.
- Anything running at REPEATABLE READ or SERIALIZABLE **must retry on
  [SQLSTATE `40001`](https://www.postgresql.org/docs/current/errcodes-appendix.html)**
  (`serialization_failure`). If you see that error in your logs being swallowed, you've found
  a bug.

## The guarantees you get for free

The first five rows of the table are all ✅ — every PostgreSQL isolation level provides
them. They're worth *seeing* once, because other databases (and Hermitage's weaker rows for
them) show these can genuinely fail elsewhere.

### Dirty writes (G0)

Two transactions interleave writes to the same rows. Row locks force the second writer to
wait, so the result is always *one transaction's* writes, never a mix:

<!--@include: ./parts/dirty-write.md-->

### Intermediate reads (G1b)

A transaction that changes a value twice never leaks the draft — readers see only final,
committed states:

<!--@include: ./parts/intermediate-read.md-->

### Circular information flow (G1c)

Two concurrent transactions can never each read the other's uncommitted writes — that
exchange has no serial explanation:

<!--@include: ./parts/circular-information-flow.md-->

### Observed transaction vanishes (OTV)

Once a transaction commits, readers see all of it or none of it — even while a third
transaction is busy overwriting half of its rows:

<!--@include: ./parts/observed-transaction-vanishes.md-->

## Further reading

- [Hermitage](https://github.com/ept/hermitage) — runnable isolation tests for PostgreSQL,
  MySQL, Oracle, and more; this chapter proves every PostgreSQL case it covers
- [The same catalog for MySQL](/mysql/02-isolation/anomaly-catalog) — same anomalies,
  meaningfully different answers
