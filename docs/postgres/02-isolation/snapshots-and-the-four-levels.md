# Snapshots & the four levels

Isolation controls what concurrent transactions can observe and which combinations
can commit. [Concepts: isolation levels](/concepts/isolation-levels) introduces the
vocabulary. This chapter separates PostgreSQL 18 Documented contracts from outcomes
demonstrated on the version printed in each Transcript, currently 18.6.

## How PostgreSQL actually does it: snapshots

[PostgreSQL's MVCC introduction](https://www.postgresql.org/docs/18/mvcc-intro.html)
documents snapshot-based access to row versions. Plain SELECTs do not wait for the
row-update locks shown in this chapter. That does not mean only same-row writers
can wait: [table locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-TABLES)
can block SELECT, and locking reads can wait for row locks.

The following table summarizes the
[PostgreSQL 18 isolation contracts](https://www.postgresql.org/docs/18/transaction-iso.html).
Snapshot visibility includes prior writes by the reading transaction; sequences have
separate rules. Updating and locking commands need the operation-specific rules in
the following lessons.

| You ask for | You get | Plain SELECT snapshot |
|---|---|---|
| READ UNCOMMITTED | READ COMMITTED behavior | new snapshot per query |
| READ COMMITTED, the default | READ COMMITTED | new snapshot per query |
| REPEATABLE READ | PostgreSQL snapshot isolation, no phantoms from concurrent commits | snapshot from the first non-transaction-control statement |
| SERIALIZABLE | REPEATABLE READ visibility plus SSI monitoring | transaction snapshot, with possible serialization failure |

[The READ UNCOMMITTED schedule](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them)
demonstrates one uncommitted UPDATE remaining invisible. The
[REPEATABLE READ schedule](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms)
demonstrates exclusion of later committed changes and visibility of own writes.
Neither finite schedule establishes the complete contract by itself.

## Choosing a level

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SET default_transaction_isolation = 'repeatable read';
```

These are alternative forms, not a sequence to run inside one transaction.
[SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html#SQL-SET-TRANSACTION-DESCRIPTION)
documents that the isolation level cannot change after the first query or data-modification
statement. The session default applies to subsequent transactions; it does not change
a current transaction's established snapshot.

## Further reading

- [PostgreSQL 18: Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [The same lesson on MySQL](/mysql/02-isolation/snapshots-and-the-four-levels)
