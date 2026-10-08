# ORM pitfalls

Inspect the SQL and transaction settings your ORM actually uses. The examples
below demonstrate database behavior, not the defaults or APIs of any ORM.

## Pitfall #1: the transaction that outlives the query

An application can update a row and then stop issuing queries while its
transaction remains open. The example sets a 500ms idle timeout, observes the
idle session, waits 1500ms, and checks termination and rollback:

<!--@include: ./parts/idle-in-transaction-timeout.md-->

No external API call runs here; the sleep models idle client time. PostgreSQL 18's
[idle timeout contract](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT)
terminates a session idle in an open transaction beyond the configured interval.
The Bun client observes a closed connection on COMMIT; the independent Python
driver can report `25P03`. The monitor asserts that the session has disappeared
and the order remains pending. No server log is captured by this transcript.

This transaction holds the lock acquired by its UPDATE until it ends. Effects
on [DDL](/postgres/03-locking/table-locks-and-ddl) and
[reclamation](/postgres/04-mvcc/long-transactions) depend on the lock modes and
snapshot or xid horizon involved. Not every open transaction or `await` pins
every row version. Keep slow external work outside the transaction where the
application rule permits it. Choose timeouts for your workload; the values in
this demo are test settings, not measured production thresholds.

## Pitfall #2: no transaction where you assumed one

A separate read followed by a literal-value update can reproduce the
[lost-update schedule](/postgres/02-isolation/lost-update), whether an ORM or
handwritten SQL issues it. An explicit READ COMMITTED transaction alone does
not repair that stale write. Verify the ORM's generated SQL and enable the
appropriate [repair](/postgres/05-patterns/fixing-lost-updates): a relative
UPDATE, a locking read in the same transaction, or a checked version predicate.
No ORM feature or default is tested here.

## Pitfall #3: trusting default isolation

PostgreSQL 18 normally defaults to READ COMMITTED, but the
[default setting](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-DEFAULT-TRANSACTION-ISOLATION)
can be changed by configuration or the client. Inspect the session and
transaction level. If REPEATABLE READ or SERIALIZABLE is required, also handle
[`40001` recovery](/postgres/05-patterns/retrying-serialization-failures).
Whether an ORM restarts application logic depends on that ORM's contract.
The database examples here establish no universal ORM retry behavior.

## Further reading

- [PostgreSQL 18: Client settings](https://www.postgresql.org/docs/18/runtime-config-client.html)
- [The same lesson on MySQL](/mysql/05-patterns/orm-pitfalls)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-patterns) records the exact manual support and execution limits for this lesson.
