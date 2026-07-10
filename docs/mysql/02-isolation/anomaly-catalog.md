# The anomaly catalog

What each MySQL isolation level does about every named anomaly, and the proof. The anomalies
themselves (definitions, diagrams, and where the G-codes come from) live in
[Concepts: the anomaly catalog](/concepts/isolation-anomalies); this page is MySQL's answer
sheet, covering every case [Hermitage](https://github.com/ept/hermitage) tests — including
the rows where MySQL's answer differs from PostgreSQL's.

The short version: on MySQL,
[isolation levels protect reads, not read-modify-write cycles](#the-mysql-specific-pattern),
so the ⚠️ cells in the bottom half of this table get fixed with locks or SQL arithmetic rather
than the isolation knob. The REPEATABLE READ default
[still loses updates](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you) and
[current reads see phantoms](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot),
while SERIALIZABLE closes the rest with locks — so plan to
[retry on `1213`](#error-codes-to-retry-on).

| Code | Anomaly | READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ *(default)* | SERIALIZABLE |
|---|---|---|---|---|---|
| G0 | **Dirty write** | ✅ impossible — [proof](#dirty-writes-g0) | ✅ | ✅ | ✅ |
| G1a | **Dirty read** (aborted read) | ⚠️ [happens](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) | ✅ impossible | ✅ | ✅ |
| G1b | **Intermediate read** | ⚠️ [happens](#intermediate-reads-g1b) | ✅ impossible — [proof](#intermediate-reads-g1b) | ✅ | ✅ |
| G1c | **Circular information flow** | ⚠️ [happens](#circular-information-flow-g1c) | ✅ impossible — [proof](#circular-information-flow-g1c) | ✅ | ✅ |
| OTV | **Observed transaction vanishes** | ⚠️ [happens](#observed-transaction-vanishes-otv) | ✅ impossible — [proof](#observed-transaction-vanishes-otv) | ✅ | ✅ |
| P2 | **Non-repeatable read** | ⚠️ | ⚠️ [happens](/mysql/02-isolation/read-committed#non-repeatable-reads) | ✅ prevented (plain SELECTs) — [proof](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms) | ✅ |
| G-single | **Read skew** | ⚠️ | ⚠️ [happens](/mysql/02-isolation/read-committed#read-skew-a-total-that-never-existed) | ⚠️ plain SELECTs safe — [but writes aren't](/mysql/02-isolation/repeatable-read#your-delete-and-your-select-live-in-different-worlds) | ✅ |
| PMP | **Phantom read** | ⚠️ | ⚠️ [happens](/mysql/02-isolation/read-committed#phantoms) | ⚠️ plain SELECTs safe — [current reads see phantoms](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot) | ✅ |
| P4 | **Lost update** | ⚠️ | ⚠️ [happens](/mysql/02-isolation/lost-update#at-read-committed) | ⚠️ **still happens** — [proof](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you) | ✅ prevented (locks + deadlock) |
| G2-item / G2 | **Write skew** (item & predicate) | ⚠️ | ⚠️ | ⚠️ [happens](/mysql/02-isolation/serializable#write-skew-at-repeatable-read) | ✅ prevented — [proof](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) |

## The MySQL-specific pattern

Reading this table column by column, one theme emerges: on MySQL, isolation levels protect
reads, not read-modify-write cycles. REPEATABLE READ gives your SELECTs a perfectly stable
world — and your UPDATEs a completely different, current one. Everything in the bottom half
of the table is fixed with explicit locking or SQL-side arithmetic, not with the isolation
knob.

PostgreSQL's catalog looks different: its RR turns lost updates into retryable errors, its
SERIALIZABLE detects write skew without locks, and its weakest level is Hermitage-clean — see
[both engines' answers side by side](/concepts/anomalies-by-engine). The three ⚠️ cells in
MySQL's REPEATABLE READ column are exactly where Hermitage's results for the two databases
diverge, and all three trace back to [current reads](/mysql/02-isolation/repeatable-read).

## What READ UNCOMMITTED really costs

The G1 family and OTV are all ✅ from READ COMMITTED up — but unlike PostgreSQL, MySQL
really does serve dirty data if you ask for it, so each one is observable:

### Dirty writes (G0)

The one guarantee *every* level keeps: InnoDB always takes exclusive row locks for writes,
so interleaved writes can't produce a state no serial order could:

<!--@include: ./parts/dirty-write.md-->

### Intermediate reads (G1b)

At READ UNCOMMITTED you don't only read uncommitted data — you read *drafts* the writer
later overwrites, values that are never part of any committed history:

<!--@include: ./parts/intermediate-read.md-->

### Circular information flow (G1c)

Two transactions reading each other's uncommitted writes — an exchange with no serial
explanation, and gone at READ COMMITTED:

<!--@include: ./parts/circular-information-flow.md-->

### Observed transaction vanishes (OTV)

At READ UNCOMMITTED a committed transaction can be visible in pieces — one row already
overwritten by an uncommitted successor, the other still showing through:

<!--@include: ./parts/observed-transaction-vanishes.md-->

## Error codes to retry on

| errno | SQLSTATE | Meaning | Where you saw it |
|---|---|---|---|
| `1213` | 40001 | Deadlock found; transaction rolled back | [SERIALIZABLE write skew](/mysql/02-isolation/serializable), [deadlocks](/mysql/03-locking/deadlocks) |
| `1205` | HY000 | Lock wait timeout; **statement** rolled back, transaction survives | [lock timeouts](/mysql/03-locking/nowait-skip-locked) |

## Further reading

- [Hermitage](https://github.com/ept/hermitage) — runnable isolation tests for MySQL,
  PostgreSQL, Oracle, and more; this chapter proves every MySQL case it covers
- [MySQL docs: Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [Anomalies by engine](/concepts/anomalies-by-engine) — both engines' answers collapsed to one
  cell each, in adjacent columns
- [The same catalog for PostgreSQL](/postgres/02-isolation/anomaly-catalog) — the full grid
