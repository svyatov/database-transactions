# Check-then-insert: the race you've already shipped

Somewhere in most codebases there is an "is this email taken?" query followed by an
INSERT. It looks correct — and it's a race. Between your check and your insert, another
transaction can do both. No isolation level shy of SERIALIZABLE saves you, because each
transaction's check honestly saw a world without the row.

## Watch the duplicate land

<!--@include: ./parts/check-then-insert-race.md-->

No error, no blocking — both transactions did exactly what they were told. The
application's uniqueness "rule" lived only in application code, and concurrent code
paths don't read each other's minds. (This is [write skew](/postgres/02-isolation/serializable)'s
little sibling: two decisions, each valid in its own snapshot, jointly wrong.)

::: warning A check in code is not a constraint
This race ships silently — no error, no lock wait, nothing in the logs — and surfaces as
"impossible" duplicate rows weeks later. If uniqueness matters, declare it `UNIQUE`.
:::

## The fix is a constraint, not cleverer code

Uniqueness is the database's job. With `UNIQUE`, the same race becomes a wait-then-error —
and `ON CONFLICT` turns even that error into a plan:

<!--@include: ./parts/on-conflict.md-->

The middle beat deserves a pause: B's insert had to wait. A unique index can't accept or
reject the duplicate until the first insert's fate is known, so B queues on A's
transaction — the same
[transactionid wait you saw in lock queues](/postgres/03-locking/lock-queues) — and fails only
once A commits. Then the manual's escape hatch:
["ON CONFLICT can be used to specify an alternative action to raising a unique constraint or exclusion constraint violation error"](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT) —
`DO NOTHING` absorbs the duplicate, and `DO UPDATE` (upsert) comes with a strong
guarantee:
["ON CONFLICT DO UPDATE guarantees an atomic INSERT or UPDATE outcome; provided there is no independent error, one of those two outcomes is guaranteed, even under high concurrency."](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)

The lesson under all three beats: a SELECT can't enforce uniqueness, because by the time
you act on its answer it's already stale. Invariants belong in the schema, where `UNIQUE`
turns the silent duplicate into a loud `23505` and `ON CONFLICT` turns that `23505` into
control flow — atomically, no retry loop required. Keep the check-first query if you like
the friendlier error message, but treat it as UX, not integrity. That same constraint,
paired with `RETURNING`, is the backbone of the next lesson:
[idempotency keys](/postgres/05-patterns/idempotency).

## Further reading

- [PostgreSQL docs: INSERT ... ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
- [The same lesson on MySQL](/mysql/05-patterns/check-then-insert)
