---
description: Transaction concepts and engine comparisons, with scoped demonstrations, documented contracts, and marked derivations.
---

# Transaction concepts

Two halves. The theory doesn't change when you switch databases: what a transaction promises,
what the isolation levels trade away, and the full vocabulary of things that go wrong. What each
engine actually *does* about that vocabulary changes a great deal, and the comparison below puts
PostgreSQL's and MySQL's answers in adjacent cells. Demonstrated schedules, documented contracts, and marked derivations have distinct evidence limits. Not every reference cell has a direct execution.

## Theory

- **[What is a transaction? (ACID)](/concepts/what-is-a-transaction)**: the unit of work,
  and what each of the four letters actually promises.
- **[Isolation levels](/concepts/isolation-levels)**: the SQL standard's four-level ladder,
  what each level permits, and where the standard stops telling the whole story.

## The anomalies

The **[anomaly catalog](/concepts/isolation-anomalies)** names every isolation anomaly, from
the SQL standard's classic three to Adya's full formal list. The five that matter most in
practice get their own pages:

- [Dirty read](/concepts/dirty-read): seeing data that was never committed
- [Non-repeatable read](/concepts/non-repeatable-read): the same query, two answers
- [Phantom read](/concepts/phantom-read): new rows appearing between your queries
- [Lost update](/concepts/lost-update): an overwritten stale read-modify-write
- [Write skew](/concepts/write-skew): both transactions commit, the invariant dies

## The comparison

- **[Anomalies by engine](/concepts/anomalies-by-engine)**: one row per anomaly, one column per
  engine, with operation-specific exclusions and their support. The in-transaction lost-update rows differ between the engines.

## Patterns

- **[Dual writes & the transactional outbox](/concepts/transactional-outbox)**: why you
  separately committed effects are outside local rollback, and what the database-local pattern does establish.

## Then pick an engine

Theory is where the databases agree. The lessons are in where they don't:

- **[The PostgreSQL track](/postgres/01-basics/what-is-a-transaction)**: snapshots
  and operation-scoped visibility, including `40001` target/dependency failures. Plain reads exclude concurrent uncommitted table changes at every level.
- **[The MySQL track](/mysql/01-basics/what-is-a-transaction)**: InnoDB's locks and current
  reads, dirty-read demonstrations at READ UNCOMMITTED, and configured waits/deadlock/timeout scope. Conflicts can also wait and succeed.
