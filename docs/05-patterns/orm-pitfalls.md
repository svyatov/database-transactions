# ORM pitfalls

ORMs are fine. What bites is the transaction machinery they hide. The three failure
modes below account for most "the database is slow / the table keeps growing /
everything is locked" incidents in ORM codebases — and every one of them is a lesson
this site has already proven, wearing a nicer API.

## Pitfall #1: the transaction that outlives the query

The classic: transaction-per-request middleware (or an explicit `transaction { ... }`
block) opens a transaction, and the handler then calls a payment API, renders a
template, `await`s something slow. The database sees a session that is
**idle in transaction** — holding [row locks](/03-locking/row-locks), blocking
[DDL](/03-locking/table-locks-and-ddl), and pinning
[VACUUM's horizon](/04-mvcc/long-transactions) — while your code isn't talking to it at
all. Here is that story end to end, including the guardrail that ends it:

<<< ../../scenarios/05-patterns/idle-in-transaction-timeout.ts#demo{ts}

<!--@include: ./parts/idle-in-transaction-timeout.md-->

The timeout is
[`idle_in_transaction_session_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT):
["Terminate any session that has been idle (that is, waiting for a client query) within an open transaction for longer than the specified amount of time."](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT)
Note *terminate*, not "cancel a query" — there is no query. The server logs a `FATAL`
with SQLSTATE [`25P03`](https://www.postgresql.org/docs/current/errcodes-appendix.html)
(`idle_in_transaction_session_timeout`) and hangs up; the client, as the transcript
shows, just finds a dead connection on its next statement, and the uncommitted UPDATE
is gone. That rollback is the point: better a failed request than a database-wide
pileup. Keep transactions free of network I/O, and set this timeout as a seatbelt —
alongside `transaction_timeout` and `statement_timeout`,
[both proven in chapter 8](/08-production/long-and-idle-transactions).

## Pitfall #2: no transaction where you assumed one

The inverse failure. Without an explicit transaction block, most ORMs run each
`save()` / `update()` as its own small transaction — so *load entity, change field in
memory, save* is exactly chapter 2's
[read-modify-write lost update](/02-isolation/lost-update): the save writes every stale
value the object was loaded with. The fixes are the
[previous lesson's](/05-patterns/fixing-lost-updates), and ORMs ship two of them under
friendlier names: "optimistic locking" (a version column, fix #3) and
`SELECT ... FOR UPDATE` (usually a `lock`/`forUpdate` query option, fix #2). They only
work if you turn them on.

## Pitfall #3: trusting default isolation

An ORM transaction block gives you the database's default — READ COMMITTED, with every
anomaly [chapter 2](/02-isolation/snapshots-and-the-four-levels) demonstrated at that
level. If a unit of work needs REPEATABLE READ or SERIALIZABLE, you must say so (every
serious ORM lets you set the isolation level per transaction) — and then you own the
[`40001` retry loop](/05-patterns/retrying-serialization-failures), because the ORM
won't rerun your business logic for you.

## Key takeaways

- An ORM transaction is open from its first statement until your code returns —
  **every** `await` inside it holds locks and pins VACUUM. No network I/O inside
  transactions; `idle_in_transaction_session_timeout` as the backstop.
- Object-style read-modify-write is a lost update by default. Enable your ORM's
  version-column support or lock the row at the read.
- Isolation level and retry-on-`40001` are your job, not the ORM's. It will happily run
  write-skewed logic at READ COMMITTED forever.

## Further reading

- [PostgreSQL docs: `idle_in_transaction_session_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT)
- [PostgreSQL docs: Error Codes Appendix](https://www.postgresql.org/docs/current/errcodes-appendix.html)
