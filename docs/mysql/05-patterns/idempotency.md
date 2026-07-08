# Idempotency keys: exactly-once, built from at-least-once

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

The ordinary case is a retry that arrives after the original already committed. The second
INSERT affects 0 rows, so the handler skips the charge and replays the recorded response.

The case that kills naive check-then-act code is the retry that races the original while
it's still in flight. The duplicate-key check parks the retry on the original's
uncommitted row, the same wait you saw in
[check-then-insert](/mysql/05-patterns/check-then-insert); when the original commits, the
retry resolves to 0 affected rows and declines to charge. Had the original *rolled back*
instead, the retry would have seen 1 affected row and correctly done the work itself.

What holds both cases together is that the key and the work commit as a unit. The INSERT
and the balance UPDATE share one transaction, so there's no window where the charge
happened but the key is missing, or the reverse — the same discipline as the
[transactional outbox](/mysql/06-distributed/transactional-outbox), state and its evidence
in one atomic write.

One design note: store the *result* (or enough to reconstruct the response) in the
idempotency row, as the `amount` column sketches here — a retry has to answer the client,
not only decline to charge.

The 0-versus-1 probe leans on one driver assumption. The affected-rows count reports 0 for
a no-op upsert only when the connection was opened *without* `CLIENT_FOUND_ROWS`; set that
flag and an unchanged row reports 1 instead, which leaves the probe unable to tell a first
charge from a replay. Check your driver before you trust the count.

The shape stays small: a client-named key, a PRIMARY KEY that turns the second attempt
into a visible duplicate, and an INSERT whose affected-rows count decides whether to do the
work or replay the stored answer. Commit the key and the side effect in the same
transaction, and the unique index's own locking handles the in-flight duplicate for you —
no advisory locks, no pre-flight SELECT, no isolation-level tricks required.

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/idempotency)
