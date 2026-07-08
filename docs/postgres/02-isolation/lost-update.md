# Lost updates

Read a value, modify it in application code, write it back — run two of these concurrently
and one deposit vanishes outright: no error, no log line, nothing. Why the innocent
read-modify-write pattern loses data is
[Concepts: the lost update problem](/concepts/lost-update); this page proves the loss on
PostgreSQL, then shows the isolation level that refuses to play along.

## Watch a deposit disappear

<!--@include: ./parts/lost-update-read-committed.md-->

::: warning No error to catch
There is nothing to handle, retry, or alert on — at the default level the loss is invisible
to your code, your logs, and your monitoring. You find it in the books, weeks later.
:::

## REPEATABLE READ turns it into an error

The same interleaving, one isolation level up. PostgreSQL detects that B's write would
overwrite a row modified after B's snapshot — and refuses:

<!--@include: ./parts/lost-update-repeatable-read.md-->

If you remember one thing from this chapter, make it this: read-modify-write through application
code at READ COMMITTED loses updates silently. Move one level up and REPEATABLE READ (or
SERIALIZABLE) turns that silent loss into SQLSTATE `40001` — the data is safe and the losing
transaction retries. Raising the isolation level is only one of
[the fixes](/concepts/lost-update#the-fixes), and often not the best one:
[fixing lost updates](/postgres/05-patterns/fixing-lost-updates) walks through atomic updates,
`FOR UPDATE`, and version columns, each with its own transcript.

## Further reading

- [PostgreSQL docs: Repeatable Read Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
- [The same lesson on MySQL](/mysql/02-isolation/lost-update)
