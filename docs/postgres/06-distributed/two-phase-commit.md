# Two-phase commit: PREPARE TRANSACTION

PostgreSQL implements a participant in a two-phase commit protocol. This
scenario prepares one local transaction, terminates its originating
backend, and resolves it from another session. It does not run a global
coordinator, multiple databases, or a server-crash recovery test.
The [PostgreSQL 18 PREPARE contract](https://www.postgresql.org/docs/18/sql-prepare-transaction.html)
stores prepared state on disk and describes a high probability of a
successful later commit, not an unconditional inability to fail.

Session A prepares, M monitors and terminates A, and B later commits the
prepared transaction. The configured `max_prepared_transactions=10` and
superuser access enable this demonstration; the feature is disabled by
the [default value of zero](https://www.postgresql.org/docs/18/runtime-config-resource.html#GUC-MAX-PREPARED-TRANSACTIONS).

<!--@include: ./parts/two-phase-commit.md-->

A no longer sees its prepared update in a new standalone read. The
prepared entry persists after A's backend terminates, and B's NOWAIT
locking read fails with `55P03` both before and after termination.
B commits the prepared transaction and reads balance 200. These are
Demonstrated behaviors, not evidence that every caller has permission
to resolve prepared work or that global atomicity has been exercised.

## Why that durability is also the danger

The scenario updates the unrelated `ledger` row three times after prepare.
It asserts four occupied tuple slots before and after VACUUM, then one
after COMMIT PREPARED and another VACUUM. The retained transaction horizon
constrains removal of these versions; it does not make every VACUUM task
or every table's reclamation stop. It does not mean a prepared snapshot
reads every intermediate version.

The PREPARE manual warns that long-lived prepared transactions interfere
with storage reclamation and can contribute to wraparound shutdown. They
retain their locks until resolved. Monitor
[`pg_prepared_xacts`](https://www.postgresql.org/docs/18/view-pg-prepared-xacts.html)
and arrange explicit recovery of unresolved work. No automatic expiry is
supplied by this protocol; the scenario tests no timeout or restart.

## Should you use it?

The manual reserves this facility for external transaction managers.
[COMMIT PREPARED](https://www.postgresql.org/docs/18/sql-commit-prepared.html)
and [ROLLBACK PREPARED](https://www.postgresql.org/docs/18/sql-rollback-prepared.html)
must run outside a transaction block, in the same database, by the owner
or a superuser. Only COMMIT PREPARED is exercised here.
The [outbox](/postgres/06-distributed/transactional-outbox) and
[sagas](/postgres/06-distributed/sagas) have different boundaries and
recovery responsibilities; neither is a universal replacement for 2PC.

## Further reading

- [PostgreSQL 18: PREPARE TRANSACTION](https://www.postgresql.org/docs/18/sql-prepare-transaction.html)
- [The same lesson on MySQL](/mysql/06-distributed/xa-transactions)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-distributed) records the exact manual support and execution limits for this lesson.
