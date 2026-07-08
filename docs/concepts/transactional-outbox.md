---
description: The dual-write problem — you cannot atomically write to a database and a message broker — and the transactional outbox pattern that shrinks it to at-least-once delivery. With proofs on PostgreSQL and MySQL.
---

# Dual writes & the transactional outbox

Inside one database, `BEGIN` … `COMMIT` can always save you. This page is about the moment
that stops being true: your transaction needs to reach a *second* system — a message broker,
a search index, another service's API. There is no `BEGIN` that spans your database and
Kafka.

## The dual-write problem

Write to the database and publish to the broker — two writes, two systems, and a process
that can die between them. It doesn't matter which write goes first; each order picks
which lie you end up with:

```timeline
App: INSERT order, COMMIT ← the order exists
App: publish "order placed" — process dies ← the event is lost
Broker: downstream never learns about the order
```

Write-first loses events (downstream never learns about the order); publish-first invents
them (downstream processes an order that was never placed). Retries don't fix this — they
only change the odds. The two systems need to agree, and nothing makes them.

## The fix: only ever write to one system

The outbox pattern's insight is that the application never talks to the broker at all. The
event is written to the same database, in the same transaction as the order — and
[atomicity](/concepts/what-is-a-transaction), which the database has guaranteed all along,
does the rest:

```timeline
App: BEGIN
App: INSERT INTO orders …
App: INSERT INTO outbox … ← same transaction
App: COMMIT ← order and event exist together, or not at all
Relay: SELECT … FROM outbox FOR UPDATE SKIP LOCKED
Relay: publish to broker, DELETE FROM outbox, COMMIT
```

A separate *relay* process moves events from the outbox table to the broker — typically a
`SKIP LOCKED` job-queue worker pointed at the outbox: crash-safe, parallelizable, five lines
of SQL.

## At-least-once, by construction

The relay itself still performs two writes to two systems: "publish to the broker" and
"delete from the outbox". If it dies between them, the event is delivered *twice*. That is
not a bug to fix but the deal you signed: the dual-write problem never disappears; the outbox
shrinks it from "events can be lost or invented" down to "events can repeat" — and repeats
are handled with *idempotent consumers*. Exactly-once is not on the menu; idempotent
at-least-once is how grown-ups spell it.

## See it happen

Both tracks prove the failure and the fix with a real crashed relay:

- [PostgreSQL: dual writes & the outbox](/postgres/06-distributed/transactional-outbox) —
  plus [LISTEN/NOTIFY](/postgres/06-distributed/listen-notify), the transactional wake-up
  call that removes the relay's polling latency
- [MySQL: the outbox pattern](/mysql/06-distributed/transactional-outbox) — no LISTEN/NOTIFY
  there: the relay polls, or graduates to binlog-based CDC

## Further reading

- [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [microservices.io: Polling publisher](https://microservices.io/patterns/data/polling-publisher.html) —
  the relay variant both tracks demonstrate
