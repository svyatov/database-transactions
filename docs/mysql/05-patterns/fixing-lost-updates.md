# Fixing lost updates

Chapter 2 demonstrates a read-modify-write overwrite at [READ COMMITTED](/mysql/02-isolation/lost-update) and [REPEATABLE READ](/mysql/02-isolation/lost-update#repeatable-read-does-not-save-you). The three schedules below repair that single-row deposit example on InnoDB at the default REPEATABLE READ level. They do not demonstrate every isolation level or enforce arbitrary multi-row business rules.

## Fix #1: compute in SQL, not in the app

Both writers use `balance = balance + 10` inside UPDATE. B waits for A's lock, then computes from 110. The asserted final balance is 120:

<!--@include: ./parts/fix-lost-update-atomic.md-->

## Fix #2: SELECT ... FOR UPDATE

Both writers lock the row before computing the new balance. B's locking read waits for A's commit and returns 110; the final balance is 120. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) states that a locking read "reads the latest available data". Use the read and write in one explicit transaction.

<!--@include: ./parts/fix-lost-update-for-update.md-->

## Fix #3: optimistic locking with a version column

Both writers read version 1 without a locking read. Each update requires the version it read and increments it. After A commits, B's stale update affects 0 rows. B rolls back, reads version 2 in a fresh transaction, and completes the second deposit:

<!--@include: ./parts/fix-lost-update-version-column.md-->

::: warning MySQL affected-row settings matter
The [UPDATE manual](https://dev.mysql.com/doc/refman/8.4/en/update.html) states: "`UPDATE` returns the number of rows that were actually changed." `CLIENT_FOUND_ROWS` instead requests matched-row reporting, as documented in [mysql_affected_rows](https://dev.mysql.com/doc/c-api/8.4/en/mysql-affected-rows.html). Here a successful version increment changes the row, so both conventions distinguish it from a stale predicate matching no row.
:::

## Choosing between them

Use arithmetic in SQL when it expresses the complete single-row change. Use a locking read for a short transaction that must decide from that row's current state. Use a version check when an edit spans user think-time; on conflict, refresh or ask the user to reconcile the edit rather than replaying a stale overwrite automatically. Every relevant writer must follow the chosen protocol.

**Entailed guarantee†:** for these single-row updates, arithmetic under the write lock, a read/write pair protected by a retained exclusive lock, or a consistently incremented version predicate avoids the illustrated stale overwrite. † This follows from [InnoDB exclusive locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html) and the predicate discipline explained above. The transcripts show particular successful schedules; errors and broader invariants still require separate handling.

## Further reading

- [Choose a protection: stock and stale edits](/concepts/protection-choices)
- [Checked-write evidence](/mysql/05-patterns/checked-writes)
- [MySQL docs: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/fixing-lost-updates)
