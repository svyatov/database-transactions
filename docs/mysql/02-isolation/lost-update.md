# Lost updates

Two clients can read the same value, compute a replacement, and overwrite one
another. The following InnoDB schedules run on MySQL 8.4.11 with reads **inside
the updating transactions**. Each reads 100 and writes that saved value plus 10.
Both commit without error, but the final balance is 110 rather than 120.

## At READ COMMITTED

<!--@include: ./parts/lost-update-read-committed.md-->

## REPEATABLE READ does *not* save you

InnoDB UPDATE uses the current target row. It does not reject this stale literal
replacement merely because B's earlier consistent read saw an older version.
PostgreSQL's [REPEATABLE READ example](/postgres/02-isolation/lost-update) rejects
that post-snapshot target change with 40001. Neither example establishes detection
of every stale value read outside the updating transaction.

::: warning Protect the read-modify-write operation
Moving this unprotected schedule from READ COMMITTED to REPEATABLE READ does not
repair it. An ORM operation that uses locks, a version check, or atomic arithmetic
has different protection; not every ORM save has this race.
:::

<!--@include: ./parts/lost-update-repeatable-read.md-->

## The fixes

The existing [fixing lost updates](/mysql/05-patterns/fixing-lost-updates) Scenarios
execute atomic SQL arithmetic, a locking read before the decision, and a checked
version-column UPDATE. Their assumptions and conflict responses belong to those
examples. Atomic arithmetic fits increments; it is not a general repair for every
replacement or business rule. All participating writers must respect the chosen
protection, and an unmet version check needs explicit conflict handling.

SERIALIZABLE explicit transactions also change this race by locking the reads,
with possible deadlocks or waits. That is a Documented contract and an inference
from the [locking-read rules](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
and [SERIALIZABLE contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_serializable),
not a SERIALIZABLE execution of these two lost-update Scenarios. A standalone
autocommit SELECT followed by a separate UPDATE does not retain that read lock.

## Further reading

- [Concepts: lost updates](/concepts/lost-update)
- [The same lesson on PostgreSQL](/postgres/02-isolation/lost-update)
