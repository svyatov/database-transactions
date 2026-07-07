# Read Committed

READ COMMITTED is PostgreSQL's **default** isolation level — the one nearly all of your
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

The same effect applies to *sets* of rows, not just values — new matching rows appear between
your statements:

<!--@include: ./parts/phantom-read.md-->

## The subtle one: UPDATE re-checks its WHERE clause

What happens when your UPDATE has to *wait* for a lock, and the row changes while you wait?
At READ COMMITTED, PostgreSQL re-evaluates the WHERE clause against the **new** row version —
and silently skips rows that no longer match ("The search condition of the command (the
`WHERE` clause) is re-evaluated to see if the updated version of the row still matches the
search condition" — [the manual](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)):

<!--@include: ./parts/update-recheck.md-->

`UPDATE 0` — no error, no warning. If your code assumes "the row matched a moment ago, so it
was updated", this is where that assumption dies. Always check the affected-row count.

## Key takeaways

- READ COMMITTED = fresh snapshot **per statement**. A single statement is internally
  consistent; two statements may disagree with each other.
- Dirty reads cannot happen in PostgreSQL, full stop.
- Multi-statement read-modify-write logic at this level is exposed to
  [lost updates](/postgres/02-isolation/lost-update) — the most common real-world transaction bug.
- An UPDATE/DELETE that waited for a lock re-checks its WHERE against the new row version and
  may affect fewer rows than you saw. Check `UPDATE n`.

## Further reading

- [PostgreSQL docs: Read Committed Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)
- [The same lesson on MySQL](/mysql/02-isolation/read-committed)
