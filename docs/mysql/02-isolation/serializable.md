# Serializable

Some anomalies have no write-write conflict to detect. In
**[write skew](/concepts/write-skew)**, two transactions each read an invariant, each write
to a *different* row, and both commit — jointly breaking the rule both of them checked.

## Write skew at REPEATABLE READ

<!--@include: ./parts/write-skew-rr.md-->

## SERIALIZABLE stops it (with locks)

MySQL's SERIALIZABLE is REPEATABLE READ plus one rule: plain SELECTs act as
`SELECT … FOR SHARE`, so every row you read gets a shared lock. Now the two night-off
requests collide: each doctor's UPDATE needs an exclusive lock on a row the *other* is
holding a shared lock on. That's a cycle — InnoDB's deadlock detector fires instantly:

<!--@include: ./parts/write-skew-serializable.md-->

::: info Two databases, two philosophies
PostgreSQL's SERIALIZABLE ([SSI](/postgres/02-isolation/serializable)) lets both transactions
run without blocking and aborts one at COMMIT with `40001`. MySQL's is the classic
lock-based approach: readers block writers, conflicts surface as deadlocks (errno `1213`)
mid-transaction. Same guarantee, very different failure mode — your retry logic must catch
`1213`, and it will fire *before* commit, not at it.
:::

::: warning Every SELECT becomes a locking read
Switching SERIALIZABLE on globally turns your entire read traffic into shared-lock traffic —
lock waits and deadlock storms where SELECTs used to be free. Scope it to the transactions
whose invariants need it.
:::

REPEATABLE READ won't stop write skew — both transactions commit and the invariant dies
silently. SERIALIZABLE fixes that by turning every read into a shared lock, buying correctness
through blocking, so expect deadlocks under contention: they're the mechanism here, not an
accident, and your retry logic has to catch `1213`. The cheaper targeted fix, here as
everywhere, is to make the conflict explicit with `SELECT … FOR UPDATE` on the rows the
decision depends on ([locking reads](/mysql/03-locking/row-locks)).

## Further reading

- [MySQL docs: SERIALIZABLE](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_serializable)
- [MySQL docs: Deadlock Detection](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlock-detection.html)
- [The same lesson on PostgreSQL](/postgres/02-isolation/serializable)
