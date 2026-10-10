# Check-then-insert: the race you've already shipped

Checking for an email and then inserting it leaves a concurrency gap. In this InnoDB schedule at the default REPEATABLE READ level, both plain SELECTs report no matching row. With no unique constraint, both inserts commit:

<!--@include: ./parts/check-then-insert-race.md-->

::: warning A check in code is not a constraint
The final count is 2. Declare `UNIQUE` when the database must enforce email uniqueness. This schedule does not establish that every isolation level or locking strategy permits the same race.
:::

Both checks were accurate when they ran. Neither reserved the missing email. The [SERIALIZABLE lesson](/mysql/02-isolation/serializable) shows that stronger locking can instead create waits and deadlocks; that does not replace declaring the invariant in the schema.

## UNIQUE + ON DUPLICATE KEY: the fix

<!--@include: ./parts/on-duplicate-key.md-->

B's plain INSERT waits for A, then fails with `1062` after A commits. The subsequent upsert increments the existing row's `attempts` to 2 and reports 2 affected rows. The final `INSERT IGNORE` skips the duplicate and reports 0 affected rows. A rollback by the first inserter is not executed here.

The [MySQL 8.4 upsert contract](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html) applies to a conflict on a primary or unique key. It does not select a named conflict target. With multiple unique indexes, a different unique key can select the row to update. The affected-row convention is 1 for an insert, 2 for a changed update, and 0 for an unchanged update, except that `CLIENT_FOUND_ROWS` changes the last count to 1. The [idempotency recipe](/mysql/05-patterns/idempotency) requires that flag to be absent.

`INSERT IGNORE` does not downgrade every error. The [INSERT manual](https://dev.mysql.com/doc/refman/8.4/en/insert.html) says "Ignored errors generate warnings instead." Its ignorable conditions include duplicate keys and some invalid-value conversions. An upsert avoids that broad suppression, but its update can still fail, including on another constraint. Check the actual error and transaction state rather than treating every failure as a duplicate.

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [MySQL docs: INSERT](https://dev.mysql.com/doc/refman/8.4/en/insert.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/check-then-insert)
