# Fixing lost updates

Chapter 2 proved the bug twice: the read-modify-write race
[loses a deposit at READ COMMITTED](/mysql/02-isolation/lost-update), and — unlike
PostgreSQL — [REPEATABLE READ doesn't save you](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you).
On MySQL there is no isolation level short of SERIALIZABLE that turns this bug into an
error, so the fix has to be in your SQL. All three fixes below work at any isolation level.

## Fix #1: compute in SQL, not in the app

If the new value is derivable in SQL, put the arithmetic *inside* the UPDATE. One
statement = one atomic read-modify-write; the row lock does the serializing for you:

<!--@include: ./parts/fix-lost-update-atomic.md-->

## Fix #2: SELECT ... FOR UPDATE

When business rules must run in application code between the read and the write, lock the
row *at the read*. On MySQL this has a second, PostgreSQL-less virtue: a locking read is a
[current read](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot)
— it pierces the snapshot and returns the latest committed value, which is exactly what a
read-modify-write needs:

<!--@include: ./parts/fix-lost-update-for-update.md-->

## Fix #3: optimistic locking with a version column

Pessimistic locks hold everyone else out while the app thinks. The optimistic variant
holds nothing: read the row's version, and make the write conditional on it. If someone
got there first you affect 0 rows — a *detectable* outcome, unlike the silent overwrite:

<!--@include: ./parts/fix-lost-update-version-column.md-->

::: warning MySQL counts changed rows, not matched rows
PostgreSQL's `UPDATE n` counts rows that *matched* the WHERE clause; MySQL's affected-rows
count is rows actually *changed* (unless your driver sets `CLIENT_FOUND_ROWS`). The
version-column pattern is safe either way — a version bump always changes the row — but
don't build "did my WHERE match?" logic on affected rows without knowing which convention
your driver uses.
:::

## Choosing between them

Same trade-offs as [on PostgreSQL](/postgres/05-patterns/fixing-lost-updates): #1 when SQL
can express the change; #2 for short human-free transactions with real contention; #3 when
the "transaction" spans user think-time or process boundaries — nothing can hold a row
lock across an edit form. The difference is the stakes: on PostgreSQL, REPEATABLE READ is
a safety net that turns the missed case into a `40001`; on MySQL
[there is no net](/mysql/02-isolation/anomaly-catalog).

The through-line: no MySQL isolation level below SERIALIZABLE prevents a lost update, which
leaves you three tools — compute atomically in SQL, take a locking read, or carry a version
column. A `FOR UPDATE` read returns the latest committed data even at REPEATABLE READ, so
the snapshot-piercing that's a trap elsewhere becomes the feature you want here. And a
version-column write that matches 0 rows is handing you the retry signal, not a failure to
swallow.

## Further reading

- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/fixing-lost-updates)
