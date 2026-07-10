# Two-phase commit: PREPARE TRANSACTION

Sagas gave up on atomicity across systems and engineered around it. Two-phase commit
(2PC) is the other road: *actually* commit across multiple databases, by splitting
COMMIT in two. Phase one, every participant prepares — gets its transaction to the
point where commit can no longer fail, and promises to hold that pose. Phase two, a
coordinator tells everyone to commit for real. PostgreSQL implements a participant's
side natively, and the primitive is worth seeing even if you never deploy it. The
manual, after `PREPARE TRANSACTION`,
["the transaction is no longer associated with the current session; instead, its state is fully stored on disk, and there is a very high probability that it can be committed successfully, even if a database crash occurs before the commit is requested"](https://www.postgresql.org/docs/current/sql-prepare-transaction.html).

"No longer associated with the current session" is not a figure of speech. Three sessions
carry the demo, so here is the whole path first: Session A is the participant that
prepares, Session M is a monitor watching the server's state, and Session B is the
unrelated session that later finishes the job.

```timeline
Session A: UPDATE balance = 200 → ok
Session A: PREPARE TRANSACTION 'transfer-42' → detaches from the session
Session A: SELECT balance → 100 ← can't see its own prepared change
Session M: SELECT … FROM pg_prepared_xacts → transfer-42
Session B: SELECT … FOR UPDATE NOWAIT → 55P03 ← the orphan still holds the row lock
Session M: pg_terminate_backend(A) → true ← the coordinator crashes
Session A: SELECT 1 → connection closed
Session M: SELECT gid FROM pg_prepared_xacts → transfer-42 ← survived the kill
Session B: UPDATE ledger ×3 → three dead versions in an unrelated table
Session B: VACUUM ledger → reclaims nothing ← the orphan pins the xid horizon
Session B: COMMIT PREPARED 'transfer-42' → ok ← phase two, from a different session
Session B: SELECT balance → 200
Session B: VACUUM ledger → collects all three ← the horizon moved
```

<!--@include: ./parts/two-phase-commit.md-->

The session that *created* the transaction can't see its changes anymore — the
transaction has left the session and lives on disk now. Then the scenario gets violent.

Everything this site showed about crashes so far — "PostgreSQL rolls back open
transactions on disconnect" — stops at PREPARE. The killed backend took nothing with
it: the transaction, its locks, its promise all survive, waiting for *anyone* to say
`COMMIT PREPARED 'transfer-42'` or `ROLLBACK PREPARED 'transfer-42'`.

## Why that durability is also the danger

The survival superpower has a flip side: nothing expires a prepared transaction.
Crash recovery in chapter 1 was automatic; here, a coordinator that dies *between* the
phases leaves orphans that hold [row locks](/postgres/03-locking/row-locks) and pin the xid
horizon [exactly like a long transaction](/postgres/04-mvcc/long-transactions), until a human
or a transaction manager resolves them.

The two `VACUUM ledger` calls are the part that catches teams out. `ledger` has nothing to do
with the transfer: the orphan never read it, never wrote it, never locked it. VACUUM still
declines to collect a single dead version there, because a prepared transaction counts as
running and its snapshot might yet need every one of them. One forgotten `gid` freezes garbage
collection across the whole database, and the table that bloats is rarely the table anyone was
looking at. The manual is unusually stern:
["It is unwise to leave transactions in the prepared state for a long time. This will interfere with the ability of VACUUM to reclaim storage, and in extreme cases could cause the database to shut down to prevent transaction ID wraparound"](https://www.postgresql.org/docs/current/sql-prepare-transaction.html),
and
["Keep in mind also that the transaction continues to hold whatever locks it held"](https://www.postgresql.org/docs/current/sql-prepare-transaction.html).
Check `pg_prepared_xacts` whenever locks seem stuck and no session admits to holding them.

## Should you use it?

Straight from the manual:
["PREPARE TRANSACTION is not intended for use in applications or interactive sessions. Its purpose is to allow an external transaction manager to perform atomic global transactions across multiple databases or other transactional resources"](https://www.postgresql.org/docs/current/sql-prepare-transaction.html).
PostgreSQL even ships with the feature off:
["Setting this parameter to zero (which is the default) disables the prepared-transaction feature"](https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-MAX-PREPARED-TRANSACTIONS)
— this site's docker-compose sets `max_prepared_transactions=10` precisely so this
scenario can run. Unless an XA transaction manager owns both phases (including recovery
of orphans!), the [outbox](/postgres/06-distributed/transactional-outbox) and
[sagas](/postgres/06-distributed/sagas) give you the guarantees you actually need with failure
modes you can sleep through.

So the primitive earns its keep strictly as a primitive: `PREPARE TRANSACTION` detaches a
transaction from its session and makes it crash-proof, and `COMMIT PREPARED` or
`ROLLBACK PREPARED` finishes it from any session, by name. Between the phases it holds
every lock and blocks VACUUM, with no timeout and no automatic cleanup, so
`pg_prepared_xacts` is the view you keep an eye on. It's a building block for external
transaction managers, not an application tool — for anything you would actually ship,
reach for the outbox and sagas first.

## Further reading

- [PostgreSQL docs: PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html)
- [PostgreSQL docs: `max_prepared_transactions`](https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-MAX-PREPARED-TRANSACTIONS)
- [The same lesson on MySQL](/mysql/06-distributed/xa-transactions)
