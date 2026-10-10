# Sagas: compensation after a committed step

A saga coordinates separate local transactions and application-defined
compensations. This demonstration represents a flight and a hotel with two
tables in one PostgreSQL database. It runs no remote services or messaging
protocol. The [original saga paper](https://www.cs.princeton.edu/techreports/1987/070.pdf)
describes the design, rather than an engine guarantee.

## Watch a saga compensate {#watch-a-saga-fail-forward}

<!--@include: ./parts/saga-compensation.md-->

## What the transcript just proved

The flight booking commits with four seats left. A standalone READ COMMITTED
Reader sees that intermediate value. The guarded hotel update affects zero
rows because no room is available; this is a business outcome, not a SQL error.
Its transaction rolls back. A new transaction adds the seat back and asserts
five seats before committing.

Compensation is a new database change, not a rollback of the committed flight
transaction. The saga has no enclosing transaction isolating all steps. This
reader sees an intermediate commit; a reader using an older REPEATABLE READ
snapshot need not see it. The schedule does not establish every anomaly or
the behavior of every concurrent observer.

The demonstrated increment is not idempotent: repeating it would add another
seat. An application must define compensation identity, retry handling, and
intermediate-state rules. They are design responsibilities, not mechanisms
implemented by this example. Short local transactions reduce the duration of
their own locks; they do not ensure every transaction avoids all waits or
reclamation delays.

If a step sends an irreversible external effect, SQL compensation cannot
erase it. An [outbox](/postgres/06-distributed/transactional-outbox) can store
a step's event intent atomically with local work, but no saga transport,
receiver deduplication, or recovery coordinator is exercised here.

## Further reading

- [Garcia-Molina & Salem, Sagas (1987)](https://www.cs.princeton.edu/techreports/1987/070.pdf)
- [The same lesson on MySQL](/mysql/06-distributed/sagas)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-distributed) records the exact manual support and execution limits for this lesson.
