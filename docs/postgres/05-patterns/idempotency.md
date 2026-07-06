# Idempotency keys: exactly-once, built from at-least-once

Retries are everywhere you didn't put them: clients re-send timed-out requests, load
balancers replay, job queues redeliver, [your own retry loop](/postgres/05-patterns/retrying-serialization-failures)
reruns transactions. The network can only promise *at least once*. If the operation is
"charge $30", at-least-once is a lawsuit — so the receiver must make duplicates
harmless: **idempotency**.

The entire pattern is the [previous lesson's](/postgres/05-patterns/check-then-insert) unique
constraint pointed at a new target: not the data, but the *request identity*. The client
names each logical operation once (`req-42`); the server inserts that name as its first
move, and the insert's result — row or no row — decides everything:

<<< ../../../scenarios/postgres/05-patterns/idempotency-key.ts#demo{ts}

<!--@include: ./parts/idempotency-key.md-->

The gate and the charge share one transaction, and that's the load-bearing detail: if
the server crashes after inserting `req-42` but before charging, [atomicity](/postgres/01-basics/what-is-a-transaction)
rolls back *both* — a retry finds no key and safely charges. Split them, and a crash in
the gap leaves a claimed key with no charge: the retry then does nothing, forever.

## The in-flight retry

"Already processed" was easy. The nastier duplicate arrives while the original is still
running — no committed row exists to conflict with yet:

<<< ../../../scenarios/postgres/05-patterns/idempotency-key.ts#race{ts}

The unique index parks the retry until the original commits (the wait-on-transactionid
mechanics from the [previous lesson](/postgres/05-patterns/check-then-insert)), then absorbs it:
`0 rows`, no second charge. Time-of-check races simply don't exist here — there is no
check, only an insert with one winner.

## Key takeaways

- **Gate and work in the same transaction.** The idempotency-key insert and the side
  effect it guards must commit or vanish together.
- The key names the *operation*, so it must be minted by the sender — one key per
  logical action, reused verbatim on every retry of that action.
- `INSERT ... ON CONFLICT DO NOTHING RETURNING` is the whole server-side protocol: a row
  back means "do the work", nothing back means "done already — return the stored
  result". Store whatever the caller needs re-answered alongside the key.
- Only effects **inside** the transaction are protected. An email sent mid-transaction
  still sends twice; anything external needs its own idempotency story — chapter 6
  builds one: the [transactional outbox](/postgres/06-distributed/transactional-outbox).

## Further reading

- [PostgreSQL docs: INSERT ... ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
