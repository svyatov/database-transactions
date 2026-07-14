---
description: A non-repeatable read is reading the same row twice inside one transaction and getting different data. Definition, diagram, its multi-row cousin read skew, and how PostgreSQL and MySQL prevent both.
---

# Non-repeatable read

A *non-repeatable read* is reading the same row twice inside one transaction and getting
different data, because another transaction committed a change in between. Nothing you read
was uncommitted (every value was real), yet your transaction can no longer trust its own
earlier reads.

```timeline
Session A: BEGIN
Session A: SELECT balance → 100
Session B: UPDATE accounts SET balance = 200
Session B: COMMIT
Session A: SELECT balance → 200 ← same query, different answer
Session A: COMMIT
```

Formally Adya's *P2*. It is the flagship anomaly of READ COMMITTED, where every statement
gets a fresh snapshot: each statement is internally consistent, but two statements may
disagree with each other.

## Read skew

Non-repeatable reads have a nastier multi-row cousin, *read skew* (formally Adya's
G-single): read row 1, let someone move money to row 2, read row 2. Every row you saw was
committed and correct, yet the combination existed at no point in time:

```timeline
Session A: SELECT balance WHERE id = 1 → 500
Session B: moves 200 from account 1 to account 2
Session B: COMMIT
Session A: SELECT balance WHERE id = 2 → 500 ← total reads 1000; it was never 1000
```

A backup taken this way is corrupt; a report computed this way is wrong, even though no
single read misbehaved.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ COMMITTED | permitted | **happens** ([proof](/postgres/02-isolation/read-committed#non-repeatable-reads)) | **happens** ([proof](/mysql/02-isolation/read-committed#non-repeatable-reads)) |
| REPEATABLE READ | prevented | prevented ([proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms)) | prevented for plain SELECTs ([proof](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms)); UPDATE/DELETE are [current reads](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot) that bypass the snapshot |
| SERIALIZABLE | prevented | prevented | prevented |

The cure is a per-transaction snapshot: at REPEATABLE READ, both engines give your SELECTs
one frozen view for the whole transaction. MySQL's asterisk matters, though: its writes and
locking reads see the *current* data regardless of the snapshot, which is exactly how
[lost updates](/concepts/lost-update) survive there.

## Related anomalies

- [Phantom read](/concepts/phantom-read), the same effect on a *set* of rows: the rows you
  saw don't change, but new ones appear.
- [Lost update](/concepts/lost-update): what happens when you *write back* through a stale
  read instead of merely looking at it.

## See it happen

- [PostgreSQL: Read Committed](/postgres/02-isolation/read-committed), non-repeatable read,
  phantom, and read skew in one lesson
- [MySQL: Read Committed](/mysql/02-isolation/read-committed) (the same anomalies on InnoDB)
