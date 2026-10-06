# Lost updates

Two transactions can read the same balance, compute a new value in application code,
and write that stale value back. The [concept lesson](/concepts/lost-update) defines
the lost-update problem. These PostgreSQL 18.6 Scenarios compare that specific
read-modify-write operation at READ COMMITTED and REPEATABLE READ.

## Watch a deposit disappear

Both transactions read 100 and write 110. Both commit, and the asserted final balance
is 110 rather than the intended 120.

<!--@include: ./parts/lost-update-read-committed.md-->

::: warning No SQL error for this overwrite
The database accepts both writes in this schedule. The Scenario does not inspect
application logs or monitoring, and does not show that every application must miss the loss.
:::

## REPEATABLE READ turns it into an error

With REPEATABLE READ snapshots established before A commits, B's stale UPDATE
returns 40001. The balance is then 110: B's deposit has not committed. The Scenario
executes B again in a fresh transaction, rereads 110, and asserts a final balance of 120.

<!--@include: ./parts/lost-update-repeatable-read.md-->

This retry succeeds under the displayed schedule. The
[PostgreSQL 18 updating-command contract](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)
explains the post-snapshot target-row conflict. Raising isolation does not protect a
stale value read outside the transaction whose UPDATE uses it. Recovery must rerun
the reads and decision, and other schedules can require more retries.

[Fixing lost updates](/postgres/05-patterns/fixing-lost-updates) demonstrates atomic
SQL updates, FOR UPDATE, and version checks with their writer-participation requirements.

## Further reading

- [PostgreSQL 18: Repeatable Read](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)
- [The same lesson on MySQL](/mysql/02-isolation/lost-update)
