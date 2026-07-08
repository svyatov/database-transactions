# XA transactions: two-phase commit

The [outbox](/mysql/06-distributed/transactional-outbox) and [sagas](/mysql/06-distributed/sagas)
sidestep distributed transactions. XA is the machinery for doing them *for real*: the
[manual](https://dev.mysql.com/doc/refman/8.4/en/xa.html) — "XA supports distributed
transactions, that is, the ability to permit multiple separate transactional resources to
participate in a global transaction," coordinated by two-phase commit: "The process for
executing a global transaction uses two-phase commit (2PC)."

The division of labor, per the same page: "The MySQL implementation of XA enables a MySQL
server to act as a Resource Manager" — the *Transaction Manager* that coordinates the
branches is someone else's job (your application server or middleware). Phase one is
`XA PREPARE`: the database promises it *can* commit, survives anything, and waits for the
verdict. The scenario proves how literal that promise is:

## A prepared transaction outlives its session

"No longer belongs to its session" is not a figure of speech, and three sessions carry the
demo. Session A is the participant that prepares, Session M is a monitor watching the
server's state, and Session B is the unrelated session that finishes the job at the end.
Here is the whole path before the transcript walks it step by step:

```timeline
Session A: XA PREPARE 'transfer-42' → detaches from the session
Session A: SELECT balance → 100 ← can't see its own prepared change
Session M: XA RECOVER → transfer-42
Session B: SELECT … FOR UPDATE NOWAIT → 3572 ← the prepared txn still holds the row lock
Session M: KILL A → the coordinator crashes
Session A: SELECT 1 → connection closed
Session M: XA RECOVER → transfer-42 ← survived the kill
Session B: XA COMMIT 'transfer-42' → ok ← phase two, from a different session
Session B: SELECT balance → 200
```

<!--@include: ./parts/xa-transactions.md-->

## What PREPARE actually buys — and costs

Three moments in the transcript deserve a second look. The first is detachment: after
`XA PREPARE`, A itself read the *old* balance, because the transaction no longer belongs to
its session. It lives server-side now, findable only through `XA RECOVER`.

The second is survival. `KILL`-ing A's connection — the "coordinator crash" — changed
nothing. Since MySQL 8.0 a prepared XA transaction survives client disconnect and even a
full server restart, which is the entire point of phase one: once every participant has
prepared, the global commit decision can be carried out no matter who dies.

The third is that the locks stay too. B's `NOWAIT` probe failed identically before and
after the kill, because nothing expires a prepared transaction — an orphan holds its
[row locks](/mysql/03-locking/row-locks) and pins
[undo history](/mysql/04-mvcc/history-list-length) until a transaction manager (or a human
running `XA RECOVER` then `XA COMMIT`/`XA ROLLBACK` by name) resolves it. If locks seem
stuck and [no session admits to holding them](/mysql/03-locking/monitoring-locks), check
`XA RECOVER`.

## Should you use it?

The same answer as [PostgreSQL's](/postgres/06-distributed/two-phase-commit): XA is a
building block for external transaction managers (JTA servers, MSDTC-era middleware),
not an application-level tool. Unless a real TM owns both phases *including recovery of
orphans*, the outbox and sagas give you the guarantees you actually need with failure
modes you can sleep through — a stuck saga is a business problem; a stuck prepared
transaction is a database-wide lock leak.

So XA earns its keep strictly as a primitive: `XA START … XA END … XA PREPARE` detaches a
crash-proof transaction, `XA COMMIT` or `XA ROLLBACK` finishes it from any session by name,
and `XA RECOVER` lists the orphans. Between the two phases it holds every lock with no
timeout and no automatic cleanup, so a coordinator that dies mid-flight leaks a
database-wide lock. MySQL is only the Resource Manager here; coordination and orphan
recovery belong to a Transaction Manager, and if you don't have one, you don't want XA.

## Further reading

- [MySQL docs: XA Transactions](https://dev.mysql.com/doc/refman/8.4/en/xa.html)
- [The same lesson on PostgreSQL: PREPARE TRANSACTION](/postgres/06-distributed/two-phase-commit)
