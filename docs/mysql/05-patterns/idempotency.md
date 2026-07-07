# Idempotency keys: exactly-once from at-least-once

Networks deliver requests *at least* once: a response lost between the server and the
client means the client retries — and the server does the work again. For "send email"
that's an annoyance. For "charge $30" it's an incident.

The fix is the idempotency key: the client names each *intent* (`req-42`), and the server
records the name in a table whose primary key makes the second attempt visibly a
duplicate. On MySQL, `INSERT … ON DUPLICATE KEY UPDATE amount = amount` gives the perfect
probe — the
[affected-rows value](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
is `1` for a new key ("do the work") and `0` for "an existing row is set to its current
values" ("skip; return the stored result"):

<!--@include: ./parts/idempotency-key.md-->

## Why this survives every race

- **Retry after commit** — the ordinary case. The second INSERT affects 0 rows; the
  handler skips the charge and replays the recorded response.
- **Retry racing the original** — the case that kills naive check-then-act
  implementations. The duplicate-key check parks the retry on the
  original's uncommitted row (the same wait as
  [check-then-insert](/mysql/05-patterns/check-then-insert)); when the original commits,
  the retry resolves to 0 affected rows. Had the original *rolled back*, the retry would
  get 1 — and correctly do the work itself.
- **The key and the work commit together.** The INSERT and the balance UPDATE share a
  transaction, so there's no window where the charge happened but the key is missing (or
  vice versa). This is the same discipline as the transactional outbox in the next
  chapter — state and evidence in one atomic unit.

One design note: store the *result* (or enough to reconstruct the response) in the
idempotency row, as the `amount` column sketches here — a retry must answer the client,
not just decline to charge.

## Key takeaways

- Idempotency = a client-named key + a PRIMARY KEY, checked by the INSERT itself; 1
  affected row means "first time, do the work", 0 means "done before, replay the answer".
- The key row and the side effect must commit in the same transaction.
- In-flight duplicates are handled by the unique index's own locking — no advisory locks,
  no SELECTs, no isolation-level tricks.

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/idempotency)
