# Deadlocks

Two transactions, each holding a lock the other needs: neither can ever proceed. InnoDB
detects the cycle the moment it closes — no timeout involved — and resolves it by rolling
back one transaction, the *victim*, with errno `1213`.

## The classic: opposite lock order

<!--@include: ./parts/deadlock.md-->

Note what `1213` did: unlike a [lock timeout](/mysql/03-locking/nowait-skip-locked), it
rolled back B's entire transaction — bob's `-25` was undone too. The victim's only move
is to retry from the top. (InnoDB rolls back whichever transaction changed the fewest rows —
its measure of the cheaper one to undo — and you don't get to choose.)

## The cure: consistent lock order

<!--@include: ./parts/deadlock-avoidance.md-->

Detection is instant and always on (`innodb_deadlock_detect=ON`): the victim takes errno `1213`
(SQLSTATE `40001`) and a full rollback, so retrying on `1213` is mandatory in any code that
writes several rows under contention. Deadlocks aren't database bugs — they're a property of
your access order, and locking rows in one global order (by primary key, say) makes cycles
impossible, as the fix above shows. When one slips through anyway, `SHOW ENGINE INNODB STATUS`
prints the last deadlock's full story and `innodb_print_all_deadlocks=ON` logs every one.
PostgreSQL works the same way except it waits out a 1-second `deadlock_timeout` first and
reports `40P01` ([compare](/postgres/03-locking/deadlocks)); either way, when a hang turns out
not to be a deadlock, you'll want to
[see who's blocking whom](/mysql/03-locking/monitoring-locks).

## Further reading

- [MySQL docs: Deadlocks in InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html)
- [MySQL docs: How to Minimize and Handle Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html)
