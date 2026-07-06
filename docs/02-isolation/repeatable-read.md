# Repeatable Read

At REPEATABLE READ, PostgreSQL takes **one snapshot for the whole transaction** — at its
first statement (precisely: the ["first non-transaction-control statement"](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ),
so not at `BEGIN`) — and every subsequent statement reads from that same frozen view. What
you saw once, you'll see again: no non-repeatable reads, and (beyond what the SQL standard
requires) **no phantoms either**. This is what the manual and the literature call
*snapshot isolation*.

The price: your snapshot can go stale, and PostgreSQL will *refuse* to let you overwrite what
you can't see.

## One snapshot, no phantoms

<<< ../../scenarios/02-isolation/stable-snapshot.ts#demo{ts}

<!--@include: ./parts/stable-snapshot.md-->

## The write conflict: SQLSTATE 40001

Reading a stale snapshot is safe. *Writing through it* is not — if a row you're updating was
changed by a transaction that committed after your snapshot, PostgreSQL aborts you with
`could not serialize access due to concurrent update`:

<<< ../../scenarios/02-isolation/concurrent-update-40001.ts#committed{ts}

And if the competing writer hasn't committed yet, you first wait on its lock — the verdict
comes when it commits (fail) or rolls back (proceed):

<<< ../../scenarios/02-isolation/concurrent-update-40001.ts#uncommitted{ts}

<!--@include: ./parts/concurrent-update-40001.md-->

## Key takeaways

- REPEATABLE READ = one snapshot per **transaction**, taken by the first statement (not by
  `BEGIN`).
- In PostgreSQL it also prevents phantoms — stronger than the SQL standard's REPEATABLE READ
  ([Table 13.1](https://www.postgresql.org/docs/current/transaction-iso.html#MVCC-ISOLEVEL-TABLE):
  "Allowed, but not in PG").
- Any UPDATE/DELETE of a concurrently-modified row raises **40001**
  ([`serialization_failure`](https://www.postgresql.org/docs/current/errcodes-appendix.html)).
  This is not an error to log-and-swallow — the manual's own instruction is to
  ["retry the whole transaction from the beginning"](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
  (a ready-made retry helper is coming in the patterns chapter).
- Stale reads are still reads: two REPEATABLE READ transactions can each make decisions on
  their snapshots that are jointly impossible — that's [write skew](/02-isolation/serializable),
  and this level does *not* stop it.

## Further reading

- [PostgreSQL docs: Repeatable Read Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
