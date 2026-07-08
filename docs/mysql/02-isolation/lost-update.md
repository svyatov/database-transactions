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

::: warning The isolation knob will not fix this
Every ORM `save()` that reads, computes, and writes back has this bug at MySQL's default
level. The fix is structural — atomic SQL, a locking read, or a version column — not a
`SET TRANSACTION` away.
:::

<!--@include: ./parts/lost-update-repeatable-read.md-->

## The fixes

Raising the isolation level is not one of them (short of SERIALIZABLE). On MySQL you fix
lost updates *structurally* — atomic UPDATEs, `SELECT … FOR UPDATE`
([chapter 3](/mysql/03-locking/row-locks)), or an optimistic version column checked via
`affectedRows`. The three patterns are defined in
[the concept page](/concepts/lost-update#the-fixes) and each proven with a transcript in
[fixing lost updates](/mysql/05-patterns/fixing-lost-updates).

A lost update is silent: the transcript above ends with `110` where two +10 deposits on
`100` should have produced `120`, and nothing errored. Nothing short of SERIALIZABLE stops it
on MySQL — if your app reads a value, computes from it, and writes it back, the bug is there
until you apply one of the three fixes. If you're porting from PostgreSQL, code that leaned on
its REPEATABLE READ conflict detection loses that protection the moment it runs here.

## Further reading

- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
