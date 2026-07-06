# Lost updates

The most common transaction bug in real applications looks like this innocent pseudocode:

```ts
const balance = await db.query("SELECT balance FROM accounts WHERE id = $1", [id]);
await db.query("UPDATE accounts SET balance = $1 WHERE id = $2", [balance + 10, id]);
```

Read, modify in application code, write back. Run two of these concurrently and one deposit
simply **vanishes** — no error, no log line, nothing. The SQL standard doesn't even list this
anomaly; production incident reports list it constantly.

## Watch a deposit disappear

<<< ../../../scenarios/postgres/02-isolation/lost-update-read-committed.ts#demo{ts}

<!--@include: ./parts/lost-update-read-committed.md-->

## REPEATABLE READ turns it into an error

The same interleaving, one isolation level up. PostgreSQL detects that B's write would
overwrite a row modified after B's snapshot — and refuses:

<<< ../../../scenarios/postgres/02-isolation/lost-update-repeatable-read.ts#demo{ts}

<!--@include: ./parts/lost-update-repeatable-read.md-->

## Key takeaways

- Read-modify-write through application code at READ COMMITTED loses updates **silently**.
  If you remember one thing from this chapter, make it this.
- REPEATABLE READ (and SERIALIZABLE) convert the silent loss into SQLSTATE `40001` — data
  is safe, and the losing transaction retries.
- Raising the isolation level is only one of the fixes, and often not the best one.
  [Fixing lost updates](/postgres/05-patterns/fixing-lost-updates) demonstrates the alternatives:
  - **atomic updates** — `SET balance = balance + 10`: race-free even at READ COMMITTED;
  - **pessimistic locking** — `SELECT … FOR UPDATE`;
  - **optimistic locking** — a version column checked in the WHERE clause.

## Further reading

- [PostgreSQL docs: Repeatable Read Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ)
