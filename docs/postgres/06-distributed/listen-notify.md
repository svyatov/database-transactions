# LISTEN/NOTIFY: transactional wake-up calls

PostgreSQL 18's [NOTIFY contract](https://www.postgresql.org/docs/18/sql-notify.html)
defers delivery until the notifying transaction commits. That signal
does not prove the payload truthfully describes data or that the data
remains unchanged until the listener reads it.

## A listener you can see

The scenario uses a `psql` subprocess in the Docker Compose PostgreSQL
container. It waits for LISTEN to complete before sending notifications.
The periodic SELECT makes this psql listener print pending notifications;
it is not a limitation of every PostgreSQL notification client.

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#listener{ts}

## Three claims, one run

<<< ../../../scenarios/postgres/06-distributed/listen-notify.ts#demo{ts}

<!--@include: ./parts/listen-notify.md-->

The listener is silent during the configured observation before commit,
then reports the asserted channel, payload and sender. It is silent in
the observation window after rollback. Two identical notifications in
one transaction produce one observed payload and no second notification
in the window. These are Demonstrated behaviors; the manual supplies
the general commit, rollback and same-transaction folding contracts.

NOTIFY is not a durable queue for disconnected listeners. The
[LISTEN contract](https://www.postgresql.org/docs/18/sql-listen.html)
says LISTEN takes effect at commit and describes the startup race:
commit LISTEN, inspect database state in a new transaction, then use
notifications for later changes. Listener transactions can also delay
delivery. Keep transactions short and retain an outbox read/polling
recovery path. No latency improvement is measured by this example.

Both the LISTEN and NOTIFY manuals prohibit preparing a transaction that
performed the respective command for two-phase commit. That is a
Documented contract, not exercised by this listener scenario.

The [outbox](/postgres/06-distributed/transactional-outbox) retains event
intent; a notification can wake a connected relay to inspect it. No
relay delivery, disconnect replay, or consumer deduplication is tested here.

## Further reading

- [PostgreSQL 18: NOTIFY](https://www.postgresql.org/docs/18/sql-notify.html)
- [PostgreSQL 18: LISTEN](https://www.postgresql.org/docs/18/sql-listen.html)
- [MySQL outbox polling](/mysql/06-distributed/transactional-outbox)
