# What is a transaction?

A transaction groups transactional table changes so that COMMIT retains them and
ROLLBACK discards them. This chapter uses **InnoDB on MySQL 8.4.11**, with
`autocommit=1` and REPEATABLE READ unless a Scenario sets another level. These are
table-write examples, not crash, network, or external-effect tests.

The [MySQL 8.4 transaction manual](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
documents these boundaries. Nontransactional tables such as MyISAM cannot have
their writes undone by ROLLBACK. DDL can cause an
[implicit commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html),
so not every SQL operation belongs to the rollback boundary.

::: tip How to read the demos
Each Transcript and timeline comes from its linked Scenario. **Demonstrated behavior**
means the schedule executes and asserts that result. A broader **Documented contract**
needs the cited MySQL 8.4 manual; an **Entailed guarantee** is marked and explained.
One schedule does not prove all schedules. See [methodology](/about/methodology).
:::

## Atomicity, demonstrated

A credits bob by 150, then attempts to debit alice, who has only 100. The CHECK error
rolls back the failed debit statement. A's own SELECT still sees bob's credit.
Only A's explicit ROLLBACK discards that earlier successful change. B's standalone
consistent SELECTs see the original balances before and after rollback.

<!--@include: ./parts/atomicity.md-->

The error did not itself undo the transaction. The
[next lesson](/mysql/01-basics/begin-commit-rollback) distinguishes statement errors
from errors that roll back the whole transaction. Visibility also depends on the
[reader's isolation level and operation](/mysql/02-isolation/snapshots-and-the-four-levels);
READ UNCOMMITTED can expose another transaction's uncommitted changes.

## Further reading

- [MySQL 8.4: InnoDB and the ACID Model](https://dev.mysql.com/doc/refman/8.4/en/mysql-acid.html)
- [Concepts: what is a transaction?](/concepts/what-is-a-transaction)
- [The same lesson on PostgreSQL](/postgres/01-basics/what-is-a-transaction)
