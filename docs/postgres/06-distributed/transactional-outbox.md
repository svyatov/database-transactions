# The dual-write problem & the transactional outbox

A local PostgreSQL transaction covers its database changes. A separately
committed publication is outside that boundary. These examples use database
tables and explicit statement ordering, not Kafka, HTTP, or a live broker.
The [shared explanation](/concepts/transactional-outbox) describes the design;
the observations and limits of the PostgreSQL examples are given here.

## The dual-write problem

The `broker` table is a Receiver model: its records commit separately from the
order operation under study. Both tables are in one PostgreSQL database.
The first schedule deliberately omits publication after committing order 1.
The second commits a broker record, then the order insert fails its CHECK.

<!--@include: ./parts/dual-write-problem.md-->

The assertions show one order without an event and one event without its order.
No process is killed and no downstream consumer runs. These are modeled
boundary observations, not proof of permanent disagreement in every system.
If both writes used the same database transaction, this split would disappear.

## The fix: write order and event intent together {#the-fix-only-ever-write-to-one-system}

Write the order and the outbox row in the same transaction:

<!--@include: ./parts/transactional-outbox.md-->

The assertions check committed order 1 and its event, and the absence of rolled-back
order 2 and its event. The relay locks the available row, deletes it, and rolls
back explicitly. The row is selectable again; the next delete commits and the
pending count becomes zero. This is Demonstrated behavior of outbox state.

## Delivery requires a separate protocol {#at-least-once-by-construction}

The relay's publication step is explanatory narration only: this scenario
records no receiver effect. It proves neither delivery nor a repeated effect.
Its [SKIP LOCKED selection](/postgres/05-patterns/job-queue) protects database
row selection under the stated worker protocol, not external execution.

† If a relay publishes successfully before committing removal of the outbox
row, a failure in between leaves the row eligible for another publication.
That duplicate window follows from the two separate commit boundaries.
This is an Entailed guarantee, not an observed receiver count here.
An at-least-once delivery design also requires durable event retention,
continued retries, and an available receiver; this SQL alone cannot ensure them.
Consumers must handle repeats under their own effect boundary.

[LISTEN/NOTIFY](/postgres/06-distributed/listen-notify) can signal committed
work to a connected listener. Retain polling or another recovery path for
missed notifications; no relay latency is measured here.

## Further reading

- [PostgreSQL 18: Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- [Transactional outbox design](https://microservices.io/patterns/data/transactional-outbox.html)
- [The same lesson on MySQL](/mysql/06-distributed/transactional-outbox)
