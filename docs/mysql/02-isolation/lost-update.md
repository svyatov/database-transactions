# Lost updates

Two clients read a value, compute a new one in application code, and write it back — one
update silently erases the other. Why the read-modify-write pattern loses data is
[Concepts: the lost update problem](/concepts/lost-update); this page is about what makes
MySQL's version of it uniquely dangerous.

## At READ COMMITTED

<!--@include: ./parts/lost-update-read-committed.md-->

## REPEATABLE READ does *not* save you

This is the sharpest MySQL/PostgreSQL divergence in the whole chapter. PostgreSQL's
REPEATABLE READ [detects the stale write and aborts it](/postgres/02-isolation/lost-update)
with `40001`. MySQL's UPDATE is a [current read](/mysql/02-isolation/repeatable-read) — it
applies your stale arithmetic to the newest row version and raises nothing:

<!--@include: ./parts/lost-update-repeatable-read.md-->

## The fixes

Raising the isolation level is not one of them (short of SERIALIZABLE). On MySQL you fix
lost updates *structurally* — atomic UPDATEs, `SELECT … FOR UPDATE`
([chapter 3](/mysql/03-locking/row-locks)), or an optimistic version column checked via
`affectedRows`. The three patterns are defined in
[the concept page](/concepts/lost-update#the-fixes) and each proven with a transcript in
[fixing lost updates](/mysql/05-patterns/fixing-lost-updates).

## Key takeaways

- A lost update is silent: the transcript above ends with `110` where two +10 deposits on
  `100` should give `120` — and nothing errored.
- **No isolation level below SERIALIZABLE prevents it on MySQL.** If your app reads, computes,
  and writes back, it has this bug until you apply one of the three fixes.
- Porting note: code relying on PostgreSQL's RR conflict detection loses that protection
  silently on MySQL.

## Further reading

- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
