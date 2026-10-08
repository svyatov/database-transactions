# Row locks

In MySQL 8.4 InnoDB, record locks protect index records. Shared (S) record locks coexist;
exclusive (X) record locks conflict with S and X requests from other transactions.
This is a [Documented contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html),
not a compatibility rule for every InnoDB lock type. Gap locks behave differently.

## FOR UPDATE blocks writers, not consistent reads {#for-update-blocks-writers-never-readers}

The scenario uses the default REPEATABLE READ isolation and an existing primary-key row.
B's nonlocking SELECT reads the committed version while its UPDATE waits for A.
Locking reads can wait; plain SELECT in an explicit SERIALIZABLE transaction can also take locks.
A consistent read avoids record-lock waits, but can still wait for [metadata locks](/mysql/03-locking/table-locks-and-ddl).

<!--@include: ./parts/for-update-blocks.md-->

## The whole matrix: S and X

The transcript demonstrates S/S compatibility, an UPDATE waiting for S, and FOR SHARE
waiting for X. The full record-lock matrix comes from the manual above.

<!--@include: ./parts/lock-mode-matrix.md-->

## Foreign keys take row locks for you

For this declared foreign key, the child INSERT's parent check holds a shared record lock.
B's non-key UPDATE waits, and the later DELETE fails with `1451` under the default RESTRICT action.
Other referential actions, such as CASCADE, change the deletion behavior.

<!--@include: ./parts/fk-shared-lock.md-->

::: warning Declare the constraint
MySQL 8.4 parses inline column `REFERENCES` without enforcing a foreign key. Use a table-level
`FOREIGN KEY` declaration, as the [CREATE TABLE manual](https://dev.mysql.com/doc/refman/8.4/en/create-table.html) specifies.
:::

[Locking-read locks](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) last until transaction end.
Do not generalize that lifetime to all record locks: at READ COMMITTED, locks on nonmatching
rows can be released after predicate evaluation. Keep transactions short and inspect the
actual query/index path. Next: [gap locks](/mysql/03-locking/gap-locks).

## Further reading

- [MySQL docs: Locks Set by Different SQL Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
- [The PostgreSQL record-lock modes](/postgres/03-locking/row-locks)

The [reconstructed support assessment](/audits/40-reconstructed-support#mysql-locking) records the exact manual support and execution limits for this lesson.
