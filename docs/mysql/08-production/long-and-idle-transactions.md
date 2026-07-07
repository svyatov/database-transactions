# Long and idle transactions

Every chapter has ended up pointing here. The idle transaction holds
[locks](/mysql/08-production/who-is-blocking-whom), pins
[purge](/mysql/04-mvcc/history-list-length), blocks
[DDL](/mysql/03-locking/table-locks-and-ddl) — and does it all silently, because *doing
nothing* is its defining feature. This lesson is the detection kit:

<!--@include: ./parts/find-long-transactions.md-->

Detector 3 is the counterintuitive one: the report transaction never wrote a row — it
doesn't even have a [real transaction ID](/mysql/04-mvcc/read-views) — yet it's the
oldest read view on the server, which makes it exactly what
[purge waits for](/mysql/04-mvcc/history-list-length). Read-only is not harmless.

## The guardrails

PostgreSQL lets you cap transaction *and* idle-in-transaction time server-side. MySQL's
toolbox is smaller — one per-statement ceiling, one session-idle killer, and nothing in
between:

<!--@include: ./parts/timeout-guardrails.md-->

The gap matters: **there is no `idle_in_transaction_session_timeout` equivalent.** The
session that opens a transaction and then waits on a slow API for 90 seconds is invisible
to `max_execution_time` (no statement running) and untouched by any sane `wait_timeout`
(that would also kill healthy idle pool connections). Your options are the detectors
above on a schedule, an application-side transaction deadline, or a proxy that enforces
one. This is why [ORM pitfall #2](/mysql/05-patterns/orm-pitfalls) has to be fixed in
code — the server won't save you.

## Key takeaways

- `information_schema.innodb_trx` (`trx_started`) finds long transactions; joining the
  processlist (`command = Sleep`) finds the idle ones — the worst kind.
- Read-only transactions pin purge too. Age-alert on the oldest `trx_started`
  regardless of writes.
- `max_execution_time` caps SELECT runtime; `wait_timeout` reaps dead-quiet sessions and
  rolls back what they held. Neither covers idle-*in-transaction* — detect it, or
  prevent it in code.
- `innodb_lock_wait_timeout` ([chapter 3](/mysql/03-locking/nowait-skip-locked)) rolls
  back the statement, not the transaction — a half-done transaction plus a naive retry
  is a data bug.

## Further reading

- [MySQL docs: `information_schema.INNODB_TRX`](https://dev.mysql.com/doc/refman/8.4/en/information-schema-innodb-trx-table.html)
- [The same lesson on PostgreSQL](/postgres/08-production/long-and-idle-transactions)
