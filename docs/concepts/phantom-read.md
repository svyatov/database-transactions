---
description: A phantom read is running the same range query twice and getting new rows. Definition, interleaving diagram, why it differs from a non-repeatable read, and how PostgreSQL and MySQL handle phantoms at each isolation level.
---

# Phantom read

A *phantom read* is running the same *range query* twice inside one transaction and getting
new rows. No row you already saw has changed (that would be a
[non-repeatable read](/concepts/non-repeatable-read)). Instead, rows that *match your WHERE
clause* appear out of nowhere, inserted and committed by someone else between your two reads.

```timeline
Session A: BEGIN
Session A: SELECT count(*) WHERE amount > 100 → 2
Session B: INSERT INTO orders (amount) VALUES (150)
Session B: COMMIT
Session A: SELECT count(*) WHERE amount > 100 → 3 ← a phantom row appeared
Session A: COMMIT
```

The distinction matters because phantoms are about *predicates*, not rows: you can lock
every row you read and still get phantoms, because the new row didn't exist to be locked.
That's why the SQL standard treats them as a separate, harder anomaly (Adya's *PMP*,
predicate-many-preceders), and why the standard's REPEATABLE READ is allowed to permit them.

## Who prevents it

| Level | SQL standard | PostgreSQL | MySQL (InnoDB) |
|---|---|---|---|
| READ COMMITTED | permitted | **happens** ([proof](/postgres/02-isolation/read-committed#phantoms)) | **happens** ([proof](/mysql/02-isolation/read-committed#phantoms)) |
| REPEATABLE READ | *permitted* | prevented, stronger than the standard requires ([proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms)) | prevented for plain SELECTs ([proof](/mysql/02-isolation/repeatable-read#one-snapshot-no-phantoms)); [current reads see phantoms](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot) |
| SERIALIZABLE | prevented | prevented | prevented |

Both engines beat the standard here: a per-transaction snapshot freezes the *whole database*,
predicates included, so plain SELECTs at REPEATABLE READ are phantom-free on both. The
engines' fine print differs: MySQL's writes and locking reads bypass the snapshot and do see
phantoms (InnoDB's [gap locks](/mysql/03-locking/gap-locks) exist to control what those
current reads meet), while PostgreSQL keeps one view for everything and instead
[aborts stale writes](/postgres/02-isolation/repeatable-read#the-write-conflict-sqlstate-40001).

## Related anomalies

- [Non-repeatable read](/concepts/non-repeatable-read), the row-level version: same row,
  different data.
- [Write skew](/concepts/write-skew), the predicate problem's evil twin on the *write* side:
  two transactions each check a predicate, then jointly falsify it.

## See it happen

- [PostgreSQL: Repeatable Read](/postgres/02-isolation/repeatable-read), one snapshot, no
  phantoms, and the `40001` price tag
- [MySQL: Repeatable Read](/mysql/02-isolation/repeatable-read), the snapshot, the current
  reads that punch holes in it, and the predicate variant of read skew
