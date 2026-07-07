# The anomaly catalog

Every isolation anomaly with a formal name, what each level does about it, and — in the
spirit of this site — a link to the scenario that *proves* each cell. The codes (G0, G1a, …)
come from Adya's dependency-graph formalism, popularized by
[Hermitage](https://github.com/ept/hermitage), Martin Kleppmann's cross-database isolation
test suite; this catalog covers every case Hermitage tests. READ UNCOMMITTED is omitted:
in PostgreSQL it
[behaves exactly like READ COMMITTED](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them).

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

## What the standard's table doesn't tell you

The SQL standard's three-anomaly table (dirty / non-repeatable / phantom) dates from 1992.
Lost updates, write skew, and the read-only anomaly were formalized later² — and they're the
ones that actually bite in modern applications, because they emerge from *application logic*
(read, decide, write) rather than from raw statement visibility.

² Berenson et al., [*A Critique of ANSI SQL Isolation Levels*](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/) (1995);
Adya, [*Weak Consistency: A Generalized Theory and Optimistic Implementations for Distributed Transactions*](https://pmg.csail.mit.edu/papers/adya-phd.pdf) (MIT PhD thesis, 1999) — the source of the G-codes;
Fekete et al., [*Making Snapshot Isolation Serializable*](https://doi.org/10.1145/1071610.1071615)
(ACM TODS, 2005).

## Further reading

- [Hermitage](https://github.com/ept/hermitage) — runnable isolation tests for PostgreSQL,
  MySQL, Oracle, and more; this chapter proves every PostgreSQL case it covers
- [The same catalog for MySQL](/mysql/02-isolation/anomaly-catalog) — same anomalies,
  meaningfully different answers
