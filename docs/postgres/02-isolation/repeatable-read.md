# Repeatable Read

At REPEATABLE READ, PostgreSQL takes one snapshot for the whole transaction — at its
first statement (precisely: the ["first non-transaction-control statement"](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ),
so not at `BEGIN`) — and every subsequent statement reads from that same frozen view. What
you saw once, you'll see again: no non-repeatable reads, and (beyond what the SQL standard
requires) no phantoms either. This is what the manual and the literature call
*snapshot isolation*.

The price: your snapshot can go stale, and PostgreSQL will *refuse* to let you overwrite what
you can't see.

## One snapshot, no phantoms

<!--@include: ./parts/stable-snapshot.md-->

## The write conflict: SQLSTATE 40001

Reading a stale snapshot is safe. Writing through it is not: if a row you're updating was
changed by a transaction that committed after your snapshot, PostgreSQL aborts you with
`could not serialize access due to concurrent update`. And if the competing writer hasn't
committed yet, you first wait on its lock — the verdict comes when it commits (fail) or
rolls back (proceed):

<!--@include: ./parts/concurrent-update-40001.md-->

So the shape of this level: one snapshot per transaction, taken by the first statement rather
than by `BEGIN`, and in PostgreSQL that snapshot also prevents phantoms — stronger than the SQL
standard's REPEATABLE READ, which
[Table 13.1](https://www.postgresql.org/docs/current/transaction-iso.html#MVCC-ISOLEVEL-TABLE)
marks "Allowed, but not in PG". Any UPDATE or DELETE of a concurrently-modified row raises
`40001` ([`serialization_failure`](https://www.postgresql.org/docs/current/errcodes-appendix.html)),
which is not an error to log and swallow: the manual tells you to
["retry the whole transaction from the beginning"](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ),
and the patterns chapter hands you a
[ready-made retry helper](/postgres/05-patterns/retrying-serialization-failures).

One thing this level still won't give you: stale reads are reads all the same. Two REPEATABLE
READ transactions can each decide something against their own snapshot that's jointly impossible
— that's [write skew](/postgres/02-isolation/serializable), and the next level up is where it
finally gets caught.

## Further reading

- [PostgreSQL docs: Repeatable Read Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
- [The same lesson on MySQL](/mysql/02-isolation/repeatable-read)
