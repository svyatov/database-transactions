# Sagas: transactions that can't ROLLBACK

This lesson models a workflow whose steps commit separately. If a later step cannot complete, a new local transaction compensates for an earlier committed step. It does not demonstrate a multi-service saga coordinator.

## Watch a saga fail forward

The scenario uses two InnoDB tables in one database as stand-ins for flight and hotel services. It commits a flight reservation, cannot reserve a hotel room, then restores the flight seat in a new transaction:

<!--@include: ./parts/saga-compensation.md-->

The autocommit `Reader` sees 4 seats after the first commit and before compensation. The hotel's guarded UPDATE affects 0 rows, a business outcome rather than a database exception. Its local ROLLBACK does not undo the committed flight reservation. The compensation increments seats and commits; the final reader observes 5 seats.

Local transactions still have their own isolation. This workflow has no single transaction hiding all intermediate commits, but that does not mean every reader immediately sees every step: visibility depends on each reader's isolation and read view. The transcript demonstrates this Reader's observation, not global visibility across services or isolation from other workflows.

**Entailed boundary†:** a later ROLLBACK cannot undo a previously committed step. Returning a reserved seat therefore requires a new business operation, not rollback of the earlier transaction. † This follows from the [local commit boundary](/mysql/01-basics/begin-commit-rollback). Compensation is not general reversal of history; its own concurrency, failures, and repeat attempts need an application protocol. Only a successful compensation is executed here.

For a real workflow, define recoverable intermediate states, progress recording, and repeat-safe compensation. Recording a step's progress with its database-local effect uses the [same transaction boundary as an outbox](/mysql/06-distributed/transactional-outbox), but this scenario contains no progress table or crash-recovery coordinator and proves neither.

## Further reading

- [The same lesson on PostgreSQL](/postgres/06-distributed/sagas)
