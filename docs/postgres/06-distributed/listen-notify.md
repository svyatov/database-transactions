# LISTEN/NOTIFY: transactional wake-up calls

The [outbox relay](/postgres/06-distributed/transactional-outbox) polls its table; polling
trades latency for load. PostgreSQL ships the fix: `NOTIFY`, a pub/sub doorbell built
into the database and, the part that matters for this chapter, wired into transactions.
The manual:
["if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed"](https://www.postgresql.org/docs/current/sql-notify.html).
A notification can never announce data that isn't committed yet, or data that never
committed at all.

## A listener you can see

One honest wrinkle: Bun's SQL client can't receive notifications, so the listener in
this scenario is a `psql` subprocess, the same client you'd use to eavesdrop on a
channel in production. It also demonstrates a real property of the protocol: the
client only *notices* notifications when it talks to the server, hence the periodic
poke:

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#listener{ts}

## Three claims, one run

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#demo{ts}

<!--@include: ./parts/listen-notify.md-->

The de-duplication is documented behavior, not an accident:
["If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered to listeners"](https://www.postgresql.org/docs/current/sql-notify.html).

A few caveats before you lean on it. NOTIFY is a doorbell, not a mailbox: a notification
goes to sessions listening *right now*, so a relay that was down while the doorbell rang
must still find the event afterwards. That's the whole reason the combo is outbox +
NOTIFY: the outbox row is the durable fact, and the notification only says "check the
outbox", its payload can even be empty.

Two more edges are worth knowing. Delivery waits for COMMIT, so notifications from a long
transaction arrive late; the manual's advice matches
[chapter 4's](/postgres/04-mvcc/long-transactions), that
["applications using NOTIFY for real-time signaling should try to keep their transactions short"](https://www.postgresql.org/docs/current/sql-notify.html).
And LISTEN and two-phase commit don't mix, a preview of the
[next-door lesson](/postgres/06-distributed/two-phase-commit):
["A transaction that has executed LISTEN cannot be prepared for two-phase commit"](https://www.postgresql.org/docs/current/sql-listen.html).

Put together, that makes `NOTIFY` the outbox relay's wake-up call rather than its memory:
fire it in the same transaction that writes the outbox row, `LISTEN` in the relay, and
fall back to polling when no one is listening. The notification itself is disposable (it
rings for whoever is home and then vanishes), so every durability guarantee stays in the
outbox table, exactly where the previous lesson put it.

## Further reading

- [PostgreSQL docs: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL docs: LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)
- [MySQL has no LISTEN/NOTIFY](/mysql/06-distributed/transactional-outbox): its outbox lesson covers polling and binlog CDC instead
