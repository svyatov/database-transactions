# LISTEN/NOTIFY: transactional wake-up calls

The [outbox relay](/postgres/06-distributed/transactional-outbox) polls its table; polling
trades latency for load. PostgreSQL ships the fix: `NOTIFY` — a pub/sub doorbell
built into the database, and, crucially for this chapter, **wired into transactions**.
The manual:
["if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed"](https://www.postgresql.org/docs/current/sql-notify.html).
A notification can never announce data that isn't committed yet — or data that never
committed at all.

## A listener you can see

One honest wrinkle: Bun's SQL client can't receive notifications, so the listener in
this scenario is a `psql` subprocess — the same client you'd use to eavesdrop on a
channel in production. It also demonstrates a real property of the protocol: the
client only *notices* notifications when it talks to the server, hence the periodic
poke:

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#listener{ts}

## Three claims, one run

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#demo{ts}

<!--@include: ./parts/listen-notify.md-->

The de-duplication is documented behavior, not an accident:
["If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered to listeners"](https://www.postgresql.org/docs/current/sql-notify.html).

## The fine print

- **NOTIFY is a doorbell, not a mailbox.** A notification goes to sessions listening
  *right now*; a relay that was down while the doorbell rang must still find the event
  afterwards. That's why the combo is outbox + NOTIFY: the outbox row is the durable
  fact, the notification just says "check the outbox" — its payload can even be empty.
- Delivery waits for COMMIT, so notifications from a long transaction arrive late. The
  manual's advice matches [chapter 4's](/postgres/04-mvcc/long-transactions):
  ["applications using NOTIFY for real-time signaling should try to keep their transactions short"](https://www.postgresql.org/docs/current/sql-notify.html).
- LISTEN and two-phase commit don't mix — a preview of the
  [next-door lesson](/postgres/06-distributed/two-phase-commit):
  ["A transaction that has executed LISTEN cannot be prepared for two-phase commit"](https://www.postgresql.org/docs/current/sql-listen.html).

## Key takeaways

- `NOTIFY` is transactional: delivered at COMMIT, discarded on ROLLBACK, de-duplicated
  within a transaction. You can never be woken up for uncommitted data.
- Use it to make the outbox relay event-driven: `NOTIFY` in the same transaction that
  inserts the outbox row, `LISTEN` in the relay, poll only as a fallback.
- Notifications are not durable — the doorbell rings for whoever is home. Durability
  stays in the outbox table.

## Further reading

- [PostgreSQL docs: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL docs: LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)
