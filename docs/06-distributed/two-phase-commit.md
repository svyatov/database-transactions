# Two-phase commit: PREPARE TRANSACTION

Sagas gave up on atomicity across systems and engineered around it. Two-phase commit
(2PC) is the other road: *actually* commit across multiple databases, by splitting
COMMIT in two. Phase one, every participant **prepares** — gets its transaction to the
point where commit can no longer fail, and promises to hold that pose. Phase two, a
coordinator tells everyone to commit for real. PostgreSQL implements a participant's
side natively, and the primitive is worth seeing even if you never deploy it —
the manual: after `PREPARE TRANSACTION`,
["the transaction is no longer associated with the current session; instead, its state is fully stored on disk, and there is a very high probability that it can be committed successfully, even if a database crash occurs before the commit is requested"](https://www.postgresql.org/docs/current/sql-prepare-transaction.html).

"No longer associated with the current session" is not a figure of speech:

<<< ../../scenarios/06-distributed/two-phase-commit.ts#demo{ts}

<!--@include: ./parts/two-phase-commit.md-->

The session that *created* the transaction can't see its changes anymore — the
transaction has left the session and lives on disk now. Then the scenario gets violent:

<<< ../../scenarios/06-distributed/two-phase-commit.ts#survives{ts}

Everything this site showed about crashes so far — "PostgreSQL rolls back open
transactions on disconnect" — stops at PREPARE. The killed backend took nothing with
it: the transaction, its locks, its promise all survive, waiting for *anyone* to say
`COMMIT PREPARED 'transfer-42'` or `ROLLBACK PREPARED 'transfer-42'`.

## Why that durability is also the danger

The survival superpower has a flip side: **nothing expires a prepared transaction.**
Crash recovery in chapter 1 was automatic; here, a coordinator that dies *between* the
phases leaves orphans that hold [row locks](/03-locking/row-locks) and pin the xid
horizon [exactly like a long transaction](/04-mvcc/long-transactions) — forever, until
a human or a transaction manager resolves them. The manual is unusually stern:
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
of orphans!), the [outbox](/06-distributed/transactional-outbox) and
[sagas](/06-distributed/sagas) give you the guarantees you actually need with failure
modes you can sleep through.

## Key takeaways

- `PREPARE TRANSACTION` detaches a transaction from its session and makes it crash-proof;
  `COMMIT PREPARED` / `ROLLBACK PREPARED` finish it from any session, by name.
- Between the phases it holds every lock and blocks VACUUM — with no timeout and no
  automatic cleanup. Monitor `pg_prepared_xacts`.
- It's a building block for external transaction managers, not an application tool.
  Reach for the outbox and sagas first.

## Further reading

- [PostgreSQL docs: PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html)
- [PostgreSQL docs: `max_prepared_transactions`](https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-MAX-PREPARED-TRANSACTIONS)
