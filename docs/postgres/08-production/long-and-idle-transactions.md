# Long & idle transactions

The most damaging thing a session can do in PostgreSQL is nothing — inside an open
transaction. It [holds locks](/postgres/03-locking/row-locks), it
[pins VACUUM's horizon for the whole database](/postgres/04-mvcc/long-transactions), and it
occupies a pooled connection. This lesson is about finding those sessions, then making
sure they can't live long.

## Finding them

<!--@include: ./parts/find-long-transactions.md-->

Note what detector 3 proved: the report **wrote nothing** (`backend_xid` is null — no
transaction id was ever [assigned](/postgres/04-mvcc/row-versions)) and *still* pins the vacuum
horizon through its snapshot (`backend_xmin`). Read-only is not harmless — and age is
what matters: the session with the oldest `xact_start` is almost always the story.

## Guardrails: make the database enforce it

Detection finds today's incident; timeouts prevent next month's. PostgreSQL ships three,
from narrowest to widest:

<!--@include: ./parts/timeout-guardrails.md-->

- [`statement_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT):
  ["Abort any statement that takes more than the specified amount of time"](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT).
  Error `57014`, session survives — the seatbelt for runaway queries.
- [`idle_in_transaction_session_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT)
  kills exactly the "went to lunch" pattern —
  [chapter 5 proved it](/postgres/05-patterns/orm-pitfalls), server-side FATAL and all.
- [`transaction_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT)
  (PostgreSQL 17+):
  ["Terminate any session that spans longer than the specified amount of time in a transaction"](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT) —
  the hard ceiling that catches both previous cases *and* the slow-but-busy transaction
  neither of them can. One caveat from the manual, pointing straight back at
  [chapter 6](/postgres/06-distributed/two-phase-commit):
  ["Prepared transactions are not subject to this timeout"](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT).

## Key takeaways

- Watch three columns of `pg_stat_activity`: `xact_start` (age), `state`
  (`idle in transaction`), `backend_xmin` (vacuum horizon). The scenario's three
  detectors are copy-paste ready.
- Read-only transactions pin VACUUM too. Age matters, not write activity.
- Set `statement_timeout` and `idle_in_transaction_session_timeout` for every
  application role, sized to the app's real needs; add `transaction_timeout` on 17+ as
  the backstop. Kill switches beat pager duty.

## Further reading

- [PostgreSQL docs: client connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT) —
  all three timeouts
- [PostgreSQL docs: pg_stat_activity](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/08-production/long-and-idle-transactions)
