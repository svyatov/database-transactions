---
description: The engine-neutral theory of database transactions — ACID, isolation levels, the full anomaly catalog — plus the side-by-side comparison of what PostgreSQL and MySQL each do about every anomaly, with every claim linked to an executable proof.
---

# Transaction concepts

Two halves. The theory doesn't change when you switch databases: what a transaction promises,
what the isolation levels trade away, and the full vocabulary of things that go wrong. What each
engine actually *does* about that vocabulary changes a great deal, and the comparison below puts
PostgreSQL's and MySQL's answers in adjacent cells. Every claim on either side links to a
transcript from a real run that proves it.

## Theory

- **[What is a transaction? (ACID)](/concepts/what-is-a-transaction)** — the unit of work,
  and what each of the four letters actually promises.
- **[Isolation levels](/concepts/isolation-levels)** — the SQL standard's four-level ladder,
  what each level permits, and where the standard stops telling the whole story.

## The anomalies

The **[anomaly catalog](/concepts/isolation-anomalies)** names every isolation anomaly, from
the SQL standard's classic three to Adya's full formal list. The five that matter most in
practice get their own pages:

- [Dirty read](/concepts/dirty-read) — seeing data that was never committed
- [Non-repeatable read](/concepts/non-repeatable-read) — the same query, two answers
- [Phantom read](/concepts/phantom-read) — new rows appearing between your queries
- [Lost update](/concepts/lost-update) — the silent bug your app most likely has
- [Write skew](/concepts/write-skew) — both transactions commit, the invariant dies

## The comparison

- **[Anomalies by engine](/concepts/anomalies-by-engine)** — one row per anomaly, one column per
  engine, each cell naming the weakest isolation level at which that engine prevents it. The
  lost-update row is two levels apart.

## Patterns

- **[Dual writes & the transactional outbox](/concepts/transactional-outbox)** — why you
  cannot atomically write to two systems, and the pattern that shrinks the problem.

## Then pick an engine

Theory is where the databases agree. The lessons are in where they don't:

- **[The PostgreSQL track](/postgres/01-basics/what-is-a-transaction)** — snapshots
  everywhere, conflicts surface as retryable errors (`40001`), dirty reads impossible at
  every level.
- **[The MySQL track](/mysql/01-basics/what-is-a-transaction)** — InnoDB's locks and current
  reads, real dirty reads at READ UNCOMMITTED, conflicts surface as deadlocks (`1213`).
