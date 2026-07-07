# The dual-write problem & the transactional outbox

Every problem so far lived inside one database, where `BEGIN` … `COMMIT` could always
save you. This chapter is about the moment that stops being true: there is no `BEGIN`
that spans MySQL and Kafka. The theory — why two writes to two systems can't be made
atomic, and how an outbox shrinks the damage — is
[Concepts: dual writes & the outbox](/concepts/transactional-outbox); this page proves
it on MySQL, crashes included.

## The dual-write problem

Write to the database and publish to the broker — two writes, two systems, and a process
that can die between them:

<!--@include: ./parts/dual-write-problem.md-->

Write-first loses events; publish-first invents them.
[Retries only change the odds](/concepts/transactional-outbox#the-dual-write-problem).

## The fix: only ever write to one system

The application never talks to the broker at all. The event is written **to the same
database, in the same transaction** as the order — and
[atomicity](/mysql/01-basics/what-is-a-transaction), which InnoDB has guaranteed since
chapter 1, does the rest:

<!--@include: ./parts/transactional-outbox.md-->

A separate **relay** process moves events from the outbox to the broker. It is exactly
the [SKIP LOCKED job-queue worker](/mysql/05-patterns/job-queue) from chapter 5, pointed at
the `outbox` table.

## At-least-once, by construction

Look closely at what the crash proved. The relay published the event, then died before
committing the `DELETE` — so the event is delivered *twice*. That is
[the deal you signed](/concepts/transactional-outbox#at-least-once-by-construction):
at-least-once delivery — and repeats are exactly what chapter 5's
[idempotency keys](/mysql/05-patterns/idempotency) already handle on the consumer side.

## No LISTEN/NOTIFY: the relay polls

PostgreSQL pairs its outbox with
[LISTEN/NOTIFY](/postgres/06-distributed/listen-notify) — a transactional wake-up call
that removes the polling latency. **MySQL has no equivalent**: there is no server-push
channel a commit can signal. The MySQL relay polls, and that's fine — a `SELECT … FOR
UPDATE SKIP LOCKED` against an indexed, near-empty outbox every 100–500 ms is cheap, and
the polling interval is your worst-case delivery latency. If that latency matters, the
usual escalation is reading the binlog (Debezium-style change data capture), which turns
the database's own replication stream into the wake-up call — same outbox table, no
polling, considerably more moving parts.

## Key takeaways

- The order and its event commit or vanish **together**; there is no window where one
  exists without the other.
- The relay is a SKIP LOCKED worker: crash-safe, parallelizable, five lines of SQL.
  Consumers must be idempotent — delivery is at-least-once by construction.
- No LISTEN/NOTIFY on MySQL: poll (simple, bounded latency) or tail the binlog with CDC
  (fast, heavier).

## Further reading

- [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [microservices.io: Polling publisher](https://microservices.io/patterns/data/polling-publisher.html) —
  the relay variant shown here
- [The same lesson on PostgreSQL](/postgres/06-distributed/transactional-outbox) — plus its
  LISTEN/NOTIFY sequel
