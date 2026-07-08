# Check-then-insert: the race you've already shipped

"Check if the email exists; if not, insert it." Every codebase has this somewhere — a
`SELECT` followed by a conditional `INSERT`, usually via an ORM's `find_or_create`. Under
concurrency it's wrong, and the failure needs no exotic interleaving:

<!--@include: ./parts/check-then-insert-race.md-->

::: warning A check in code is not a constraint
This race ships silently — no error, no lock wait, nothing in the logs — and surfaces as
"impossible" duplicate rows weeks later. If uniqueness matters, declare it `UNIQUE`.
:::

Both transactions told the truth: at the moment each SELECT ran, no `bob@example.com`
existed. The check and the insert are two statements; the world may change between them,
and no isolation knob makes two statements one. Only the database can close that gap,
with a constraint that's checked *at* the insert:

## UNIQUE + ON DUPLICATE KEY: the fix

<!--@include: ./parts/on-duplicate-key.md-->

Three details in that transcript are worth a second look. The first is the wait: B's plain
INSERT didn't fail immediately but parked in
[the lock queue](/mysql/03-locking/lock-queues) until A's fate was decided. Had A rolled
back, B's insert would have succeeded — the constraint arbitrates the race *correctly*, not
only loudly.

The second is the affected-rows convention. Per the
[manual](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html), "the
affected-rows value per row is 1 if the row is inserted as a new row, 2 if an existing row
is updated, and 0 if an existing row is set to its current values." That `2` in the
transcript is your "it was a duplicate" signal, and the same `1`-versus-`0` distinction
powers the [idempotency pattern](/mysql/05-patterns/idempotency).

The third is `INSERT IGNORE`, the blunt instrument. It absorbs the duplicate too, but it
downgrades *every* error on the statement to a warning — type truncations included — so
reach for `ON DUPLICATE KEY UPDATE`, which handles exactly the conflict you named.

The lesson compresses to one rule: SELECT-then-INSERT can't enforce uniqueness at any
isolation level, so the constraint has to live in the database. `INSERT … ON DUPLICATE KEY
UPDATE` gives you an atomic insert-or-update, and its 1/2/0 affected-rows count tells you
which branch ran. Because the concurrent duplicate waits for the first inserter's COMMIT or
ROLLBACK before it resolves, you get correctness under the race, not only an error code
after the fact.

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/check-then-insert)
