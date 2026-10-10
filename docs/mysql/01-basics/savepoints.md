# Savepoints

The [MySQL 8.4 savepoint contract](https://dev.mysql.com/doc/refman/8.4/en/savepoint.html)
defines a named point inside a transaction. ROLLBACK TO SAVEPOINT undoes subsequent
InnoDB row changes without ending that transaction. It does not commit earlier work.
The examples run on MySQL 8.4.11, InnoDB, with explicit BEGIN.

## Discard a risky branch

The duplicate-key error rolls back one INSERT, but the preceding branch INSERT
survives until A rolls back to the savepoint. The intermediate SELECT asserts that
the branch row is gone and the earlier INSERT remains. A then commits a replacement.

<!--@include: ./parts/savepoint-recovery.md-->

## Nesting and RELEASE

The second Scenario asserts that rolling back to the outer savepoint destroys the
inner one (1305). RELEASE removes the outer bookmark without undoing row 4, and an
attempt to reuse it also fails with 1305. The final committed rows are 1 and 4.

<!--@include: ./parts/savepoint-nesting.md-->

The manual additionally documents that COMMIT and full ROLLBACK delete savepoints,
and reusing a savepoint name replaces the old point. Savepoint rollback does **not**
generally release row locks stored in memory after the savepoint. An inserted row's
lock carried in its transaction ID is released when that insertion is undone.
Those lock and same-name rules are Documented contracts, not asserted by these
INSERT-only schedules. Do not infer that a discarded branch releases every lock.

Statement recovery is error-specific. A deadlock rolls back the whole transaction,
including its savepoints; see [error handling](/mysql/01-basics/begin-commit-rollback).
Nontransactional writes and implicit-commit DDL are outside this rollback promise.

## Further reading

- [MySQL 8.4: SAVEPOINT, ROLLBACK TO SAVEPOINT, and RELEASE SAVEPOINT](https://dev.mysql.com/doc/refman/8.4/en/savepoint.html)
- [The same lesson on PostgreSQL](/postgres/01-basics/savepoints)
