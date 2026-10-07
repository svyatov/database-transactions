# Idempotency keys for database-local charges

A stable request key lets the application detect a repeated logical operation.
This PostgreSQL READ COMMITTED scenario stores the payment key and subtracts
from an account in the same transaction. It asserts one subtraction for each
of two keys, including a duplicate that arrives before the original commits.
The charge is a database balance change, not a payment-provider call.

<!--@include: ./parts/idempotency-key.md-->

`req-42` subtracts 30; its later duplicate inserts no row and reads the stored
amount. For `req-99`, the duplicate waits for A's commit and then inserts no
row. The final balance is 45, from `100 - 30 - 25`. These are Demonstrated
behaviors, not an exactly-once network-delivery guarantee. No response is
suppressed and no network failure is injected in this schedule.

## The in-flight retry

The [INSERT contract](https://www.postgresql.org/docs/18/sql-insert.html#SQL-ON-CONFLICT)
says DO NOTHING avoids the conflicting insertion and RETURNING returns rows
actually inserted or updated. At READ COMMITTED a concurrent conflict can
prevent insertion even if the conflicting row was not visible to that
statement's snapshot, as the
[isolation manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)
explains. A subsequent statement can read the committed key. Other isolation
levels and other errors need their own recovery handling.

† With a retained unique key, a stable key per operation, and every participating
writer performing the gate and the database-local work in the same transaction,
only the successful insertion authorizes that work. Atomicity commits or rolls
back the two together. This is an Entailed guarantee from the unique-constraint
and transaction contracts, not a transcript of every retry or failure path.
Treat zero returned rows as a conflict to inspect, not proof that an arbitrary
request with that key has identical parameters. Define key retention, payload
validation, and stored response handling for your application.

External effects need their own protection. The
[outbox](/postgres/06-distributed/transactional-outbox) stores event intent in
the same database transaction; it does not make a remote charge atomic.

## Further reading

- [PostgreSQL 18: INSERT](https://www.postgresql.org/docs/18/sql-insert.html#SQL-ON-CONFLICT)
- [PostgreSQL 18: Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- [The same lesson on MySQL](/mysql/05-patterns/idempotency)
