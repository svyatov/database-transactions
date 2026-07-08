# Read Committed

READ COMMITTED is PostgreSQL's default isolation level — the one nearly all of your
production code runs at. Its contract: every *statement* sees a fresh snapshot of everything
committed before that statement began. Never uncommitted data; never data committed
mid-statement.

That per-statement snapshot is both its strength (no waiting for readers, always-fresh data)
and the source of every anomaly on this page.

## No dirty reads, even if you ask for them

<!--@include: ./parts/no-dirty-reads.md-->

## Non-repeatable reads

The flagship READ COMMITTED anomaly: the same query, twice, inside one transaction — two
different answers.

<!--@include: ./parts/non-repeatable-read.md-->

## Phantoms

The same effect applies to *sets* of rows, not only values — new matching rows appear between
your statements:

<!--@include: ./parts/phantom-read.md-->

## Read skew: a total that never existed

Non-repeatable reads have a nastier multi-row cousin —
[read skew](/concepts/non-repeatable-read#read-skew): every row you read was committed and
correct, yet the combination existed at no point in time:

<!--@include: ./parts/read-skew.md-->

## The subtle one: UPDATE re-checks its WHERE clause

What happens when your UPDATE has to *wait* for a lock, and the row changes while you wait?
At READ COMMITTED, PostgreSQL re-evaluates the WHERE clause against the new row version —
and silently skips rows that no longer match ("The search condition of the command (the
`WHERE` clause) is re-evaluated to see if the updated version of the row still matches the
search condition" — [the manual](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)):

<!--@include: ./parts/update-recheck.md-->

`UPDATE 0` — no error, no warning. If your code assumes "the row matched a moment ago, so it
was updated", this is where that assumption dies. Always check the affected-row count.

The pattern to hold onto: READ COMMITTED gives you a fresh snapshot per statement, so any single
statement is internally consistent while two statements in the same transaction can flatly
disagree. Dirty reads never happen in PostgreSQL, full stop. But that same per-statement snapshot
is exactly why multi-statement read-modify-write logic here is exposed to
[lost updates](/postgres/02-isolation/lost-update), the most common real-world transaction bug,
and why an UPDATE or DELETE that waited for a lock can affect fewer rows than you saw. Check the
affected-row count, every time.

## Further reading

- [PostgreSQL docs: Read Committed Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)
- [The same lesson on MySQL](/mysql/02-isolation/read-committed)
