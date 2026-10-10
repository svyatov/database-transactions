# The dual-write problem & the transactional outbox

This chapter separates database-local changes from a publish to another system. The scenarios run on MySQL 8.4 InnoDB. They demonstrate database states and rollback boundaries, not real broker delivery or process crashes.

## The dual-write problem

The `broker` table below is a database-local stand-in, written separately from the order. In the first schedule, the order commits and the publish is omitted. In the second, the stand-in event is inserted in autocommit, then the order fails its CHECK constraint with `3819`. The scenario asserts the mismatched counts:

<!--@include: ./parts/dual-write-problem.md-->

These are two modeled failure windows, not proof of permanent disagreement or of every failure ordering. No broker or downstream consumer is observed. See the [conceptual dual-write discussion](/concepts/transactional-outbox) for the boundary being modeled.

## The fix: only ever write to one system

The application inserts the order and outbox row in the same transaction. The scenario asserts both committed records and the absence of both records from the rolled-back attempt:

<!--@include: ./parts/transactional-outbox.md-->

**Entailed guarantee†:** these InnoDB order and outbox changes share a commit boundary, provided they remain in the same transaction and no implicit commit separates them. † This follows from [transaction atomicity](/mysql/01-basics/what-is-a-transaction), not from testing every failure. It does not include an external publish.

<a id="at-least-once-by-construction"></a>

## What the relay rollback proves

The relay claims event 1 with `FOR UPDATE SKIP LOCKED`, deletes it, and rolls back. A later transaction selects that event again, deletes it, and commits. The asserted final pending count is 0. Publication is intentionally omitted: the transcript proves reselection after rollback, not two deliveries.

**Entailed delivery risk†:** if a relay publishes externally before committing its deletion, a failure after successful publication can leave the outbox row available for another attempt. † This follows from the external effect being outside the database rollback boundary. No receiver effect is recorded here. At-least-once delivery additionally requires continued successful relay attempts and a delivery service; neither is established by this SQL schedule. Consumers need a separate deduplication protocol for repeated effects. The [idempotency lesson](/mysql/05-patterns/idempotency) protects database-local work under a retained key, not arbitrary remote effects.

<a id="no-listen-notify-the-relay-polls"></a>

## Relay scheduling is outside this scenario

This SQL-only recipe selects pending rows; it does not implement a scheduler, wake-up channel, or binlog consumer. [PostgreSQL's LISTEN/NOTIFY lesson](/postgres/06-distributed/listen-notify) demonstrates a separate wake-up mechanism. For a polling relay, select an interval from measured workload and latency requirements. The interval alone is not an upper bound on delivery time: locks, backlog, transaction duration, retries, and the recipient also matter. Query cost and delivery latency are not measured here.

## Further reading

- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/06-distributed/transactional-outbox)
