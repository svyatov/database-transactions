# Deadlocks

Two transactions, each holding a lock the other needs: neither can ever proceed. InnoDB
detects the cycle **the instant it forms** (no timeout involved) and resolves it by rolling
back one transaction — the *victim* — with errno `1213`.

## The classic: opposite lock order

::: code-group
<<< ../../../scenarios/mysql/03-locking/deadlock.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/03-locking/deadlock.py#demo{py} [Python]
:::

<!--@include: ./parts/deadlock.md-->

Note what `1213` did: unlike a [lock timeout](/mysql/03-locking/nowait-skip-locked), it
rolled back **B's entire transaction** — bob's `-25` was undone too. The victim's only move
is to retry from the top. (InnoDB picks the victim by weight — roughly, the transaction that
changed fewer rows; you can't choose it.)

## The cure: consistent lock order

::: code-group
<<< ../../../scenarios/mysql/03-locking/deadlock-avoidance.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/03-locking/deadlock-avoidance.py#demo{py} [Python]
:::

<!--@include: ./parts/deadlock-avoidance.md-->

## Key takeaways

- Deadlock detection is instant and always on (`innodb_deadlock_detect=ON`) — the victim gets
  errno `1213` / SQLSTATE `40001` and a full rollback.
- Deadlocks are not bugs in the database — they're a property of your access patterns. Lock
  rows in one global order (e.g. by primary key) and cycles become impossible.
- Retry on `1213` is mandatory in any code that writes multiple rows under contention.
- `SHOW ENGINE INNODB STATUS` prints the last deadlock's full story; set
  `innodb_print_all_deadlocks=ON` to log every one.
- PostgreSQL behaves the same way, except detection runs after a 1-second `deadlock_timeout`
  and the code is `40P01` ([compare](/postgres/03-locking/deadlocks)).

## Further reading

- [MySQL docs: Deadlocks in InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html)
- [MySQL docs: How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
