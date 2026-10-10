---
description: "The outbox's database commit boundary, the modeled dual-write failure windows, and the separate conditions and duplicate risk of external delivery."
---

# Dual writes & the transactional outbox

A local transaction can group transactional database writes. An independently committed external effect is outside that rollback boundary. This page describes the boundary modeled by the [PostgreSQL](/postgres/06-distributed/transactional-outbox) and [MySQL](/mysql/06-distributed/transactional-outbox) Scenarios; neither runs Kafka, HTTP, or a delivery service. Coordinated distributed protocols have different prerequisites, covered in [two-phase commit](/postgres/06-distributed/two-phase-commit) and [XA](/mysql/06-distributed/xa-transactions).

## The dual-write problem

The two schedules deliberately commit an order without its event, or commit a database-local broker stand-in before the order fails. Both assert the resulting mismatched records. The separately committed stand-in models a recipient outside the application transaction even though both tables are in one database. No process is killed or downstream consumer observed. These are failure windows, not proof that every write ordering permanently loses or invents an event. Putting both local writes in one transaction would remove that modeled split.

The existing illustrative timeline describes an omitted external publication, not an executed crash:

```timeline
App: INSERT order, COMMIT ← database commit
App: publication omitted ← modeled failure window
Receiver: no publication recorded by this model
```

## Write order and intent together {#the-fix-only-ever-write-to-one-system}

Insert the order and outbox row in one database transaction. Both engine Scenarios assert the committed pair and absence of the rolled-back pair. A relay then locks and deletes an event, explicitly rolls back, selects it again, and commits its deletion. The final pending count is zero.

† The database-local pair shares one commit boundary, provided both writes are transactional and no implicit commit separates them. This follows from [atomicity](/concepts/what-is-a-transaction), not from testing every failure. It covers no external publication. The order/outbox assertions demonstrate the stated commit and rollback schedules.

The existing illustrative recipe separates the two boundaries:

```timeline
App: BEGIN
App: INSERT INTO orders
App: INSERT INTO outbox ← same transaction
App: COMMIT ← database-local pair
Relay: SELECT FROM outbox FOR UPDATE SKIP LOCKED
Relay: publish externally ← narration, not observed here
Relay: DELETE FROM outbox, COMMIT ← separate database completion
```

## Delivery remains conditional {#at-least-once-by-construction}

† If an external publication succeeds before deletion commits, a failure between those operations can leave the row available for another publication. This duplicate-window inference follows from separate effect and database boundaries. No Transcript here records a repeated receiver effect, and explicit rollback is not a real crashed relay.

At-least-once delivery requires durable retention, continued retries, and an available receiver. The SQL does not establish those conditions. Consumers need their own retained identity and deduplication protocol for their effect boundary. Database-local [idempotency](/postgres/05-patterns/idempotency) is not a general exactly-once external-delivery guarantee. The source [outbox design](https://microservices.io/patterns/data/transactional-outbox.html) describes the pattern, not additional execution by this project.

## See the modeled boundary {#see-it-happen}

- [PostgreSQL outbox](/postgres/06-distributed/transactional-outbox): database state assertions and explicit relay rollback. [LISTEN/NOTIFY](/postgres/06-distributed/listen-notify) observes notifications for a connected listener; it provides no durable replay or measured relay-latency bound.
- [MySQL outbox](/mysql/06-distributed/transactional-outbox): the same local boundary under InnoDB's transactional conditions. Polling and binlog-based relay scheduling are design options, not implemented delivery tests here.

## Further reading

- [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Polling publisher](https://microservices.io/patterns/data/polling-publisher.html)
