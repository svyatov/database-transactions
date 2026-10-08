# Idempotency keys: one database charge per retained key

A client can retry a request when it does not receive a response. This lesson demonstrates duplicate requests with the same key, not a network failure or delivery to a payment service. The protected effect is an InnoDB account update.

The client names its intent (`req-42`). The handler inserts that key and changes the balance in the same transaction. The demonstrated connection does not set `CLIENT_FOUND_ROWS`. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html) describes a no-op upsert as "an existing row is set to its current values": it reports 0 affected rows, or 1 with `CLIENT_FOUND_ROWS`. A new insert reports 1 and a changed existing row reports 2. That connection setting is part of this recipe.

<!--@include: ./parts/idempotency-key.md-->

<a id="why-this-survives-every-race"></a>

## What the two schedules establish

After `req-42` commits, B's duplicate affects 0 rows and reads the stored amount. The balance remains 70. For `req-99`, B's duplicate waits while A holds the uncommitted key. After A commits, B affects 0 rows; the final balance is 45. The scenario does not execute the branch where A rolls back, or assert an application response.

**Entailed guarantee†:** for this database-local recipe, a retained unique key and its protected balance change commit together. If every handler performs the balance change only after inserting a new key, competing uses of that key cannot commit another such change. This follows from the [unique-index conflict handling](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html) and [transaction boundary](/mysql/01-basics/what-is-a-transaction). † The two schedules above demonstrate particular executions, not all executions of that rule.

Keep keys for the required retry period, bind each key to one intent, and reject a changed payload. Store enough result data to answer a retry; `amount` here is only a sketch of that record. Payload validation, key expiry, and full response recovery are not executed here. Errors still need transaction cleanup and appropriate recovery. An email, broker publish, or remote charge is outside this transaction and is not made exactly-once by this key table. See the [outbox boundary](/mysql/06-distributed/transactional-outbox).

## Further reading

- [MySQL docs: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/idempotency)
