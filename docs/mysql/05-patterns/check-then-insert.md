# The check-then-insert race

"Check if the email exists; if not, insert it." Every codebase has this somewhere — a
`SELECT` followed by a conditional `INSERT`, usually via an ORM's `find_or_create`. Under
concurrency it is simply wrong, and the failure needs no exotic interleaving:

<!--@include: ./parts/check-then-insert-race.md-->

Both transactions told the truth: at the moment each SELECT ran, no `bob@example.com`
existed. The check and the insert are two statements; the world may change between them,
and no isolation knob makes two statements one. Only the database can close that gap,
with a constraint that's checked *at* the insert:

## UNIQUE + ON DUPLICATE KEY: the fix

<!--@include: ./parts/on-duplicate-key.md-->

Three things worth noticing:

- **The wait.** B's plain INSERT didn't fail immediately — it parked in
  [the lock queue](/mysql/03-locking/lock-queues) until A's fate was decided. If A had
  rolled back, B's insert would have succeeded. The constraint arbitrates the race
  *correctly*, not just loudly.
- **The affected-rows convention.** Per the
  [manual](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html): "the
  affected-rows value per row is 1 if the row is inserted as a new row, 2 if an existing
  row is updated, and 0 if an existing row is set to its current values." That `2` in the
  transcript is your "it was a duplicate" signal — and the `1`-vs-`0` distinction powers
  the [idempotency pattern](/mysql/05-patterns/idempotency).
- **`INSERT IGNORE` is the blunt instrument.** It absorbs the duplicate, but it converts
  *every* error on that statement into a warning — type truncations included. Reach for
  `ON DUPLICATE KEY UPDATE`, which handles exactly the conflict you named.

## Key takeaways

- SELECT-then-INSERT cannot enforce uniqueness at any isolation level. The constraint
  must live in the database.
- `INSERT … ON DUPLICATE KEY UPDATE` = atomic insert-or-update; affected rows 1/2/0 tells
  you which happened.
- A concurrent duplicate *waits* for the first inserter's COMMIT/ROLLBACK before
  succeeding or failing — correctness under race, not just an error code.

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/check-then-insert)
