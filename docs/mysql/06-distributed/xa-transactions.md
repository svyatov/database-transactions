# XA transactions: two-phase commit

XA provides a resource-manager interface for externally coordinated transactions. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/xa.html) states: "The MySQL implementation of XA enables a MySQL server to act as a Resource Manager". A Transaction Manager must own the global decision and recovery. This lesson executes one MySQL branch, not a complete distributed commit.

## A prepared transaction outlives its session

The scenario explicitly enables `xa_detach_on_prepare`. The [XA-state manual](https://dev.mysql.com/doc/refman/8.4/en/xa-states.html) states: "MySQL 8.4 supports detached XA transactions". With that setting ON, PREPARE detaches the branch, and another connection can resolve it. With it OFF, the branch remains associated with the original connection. The setting is part of this demonstration.

```timeline
Session A: XA PREPARE 'transfer-42' → detaches with xa_detach_on_prepare=ON
Session A: SELECT balance → 100 ← separate read cannot see the prepared change
Session M: XA RECOVER → transfer-42
Session B: SELECT … FOR UPDATE NOWAIT → 3572 ← prepared branch holds the row lock
Session M: KILL A → participant session terminates
Session A: SELECT 1 → connection closed
Session M: XA RECOVER → transfer-42 ← still prepared
Session B: XA COMMIT 'transfer-42' → completes the branch
Session B: SELECT balance → 200
```

<!--@include: ./parts/xa-transactions.md-->

## What PREPARE actually buys, and costs

After PREPARE, A reads the old balance 100; the prepared change has not committed. `XA RECOVER` lists the branch. B's `NOWAIT` read fails with `3572` before and after M kills A's connection. B then commits the prepared branch and reads 200. The scenario does not kill a coordinator process or restart the server.

The [XA-state contract](https://dev.mysql.com/doc/refman/8.4/en/xa-states.html) documents resolution of a PREPARED branch by XA COMMIT or XA ROLLBACK. The demonstrated branch retains its conflicting row lock until resolution. This does not establish a database-wide lock, retention of every lock type, undo-history growth, or survival of every possible failure.

## Should you use it?

Use XA only with a recovery design that can reconcile prepared branches with the Transaction Manager's decision. A stranded branch can block conflicting work, as the `NOWAIT` probes show. `XA RECOVER` lists prepared branches, not only orphans. Seeing an XID is not sufficient reason to choose COMMIT or ROLLBACK; that choice must follow the coordinated outcome.

The [outbox](/mysql/06-distributed/transactional-outbox) and [saga](/mysql/06-distributed/sagas) lessons describe different failure boundaries. They are not equivalent guarantees or evidence of simpler production recovery. This transcript establishes session termination and cross-session branch completion only, with detachment enabled.

## Further reading

- [MySQL docs: XA Transactions](https://dev.mysql.com/doc/refman/8.4/en/xa.html)
- [MySQL docs: XA Transaction States](https://dev.mysql.com/doc/refman/8.4/en/xa-states.html)
- [The same lesson on PostgreSQL: PREPARE TRANSACTION](/postgres/06-distributed/two-phase-commit)
