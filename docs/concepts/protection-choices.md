---
description: Choose a protection from the business rule, participating writers, and conflict response, with worked stock, stale-edit, and staffing decisions.
---

# Choose a protection

Start with the rule and the operations that can break it. An isolation-level name alone does not choose an application protocol. These five cases form a reading guide; stock, stale edits, and staffing are worked below, while request identity and external effects lead to their existing lessons.

| Business rule | Start with | Evidence and next decision |
| --- | --- | --- |
| Stock must not become negative | A checked single-row change | [Nonnegative stock](#nonnegative-stock) |
| One request identity must not create two database-local operations | A unique key and a transaction | [PostgreSQL](/postgres/05-patterns/idempotency), [MySQL](/mysql/05-patterns/idempotency) |
| A newer edit must not be silently replaced | A checked revision | [Stale edits](#stale-edits) |
| At least one doctor must remain on call | Coordinate all writers of the cross-row rule | [On-call staffing](#at-least-one-doctor-on-call) |
| An order and its effect intent must commit together | A database-local outbox transaction, with separate delivery responsibilities | [PostgreSQL](/postgres/06-distributed/transactional-outbox), [MySQL](/mysql/06-distributed/transactional-outbox) |

## Nonnegative stock

**Rule:** a single product's stored quantity must remain at least zero. A buyer requests a positive integral quantity; success means that quantity was removed, not that a previous SELECT appeared sufficient.

**Assumptions and writers:** the demonstrations use PostgreSQL 18.6 at READ COMMITTED and MySQL 8.4.11 InnoDB at REPEATABLE READ. Stock starts nonnegative, quantities fit the integer column, and every decrement writer uses the checked protocol. Reject zero, negative, or invalid requests before this operation. Restocking, administrative replacement, deletion, and other writers must preserve the same rule. This is a single-row rule, not a reservation across multiple products.

**Protection and transaction boundary:** express the decrement and its condition in the same UPDATE. In the demonstrated example two buyers each request four of five units:

```sql
UPDATE stock
SET quantity = quantity - 4
WHERE id = 1 AND quantity >= 4;
```

Each buyer uses a short explicit transaction. If an application also records an order in that transaction, it must commit that record only when the stock change succeeds; the linked stock Scenarios do not execute order creation.

**Demonstrated behavior:** A changes one row. B's UPDATE waits until A commits, then affects zero rows. B rolls back, and the asserted quantity is 1. See [PostgreSQL evidence](/postgres/05-patterns/checked-writes#two-buyers) and [MySQL evidence](/mysql/05-patterns/checked-writes#two-buyers). No separate application balance calculation is written back.

**Conflict response:** one changed row means this decrement succeeded. Zero rows means the condition was unmet or the product was absent; do not report a purchase as successful. Roll back related work, then inspect current state if the UI must distinguish missing stock from a missing product. Return a controlled unavailable result or ask for a smaller quantity. A deadlock or serialization error is a separate transaction failure, not a zero-row result; follow the engine's [error guidance](/errors/). This fixed schedule does not assert every stronger isolation level or failure path.

**Tempting failed repair:** read quantity, check it in application code, then send an unconditional decrement or saved replacement. The gap between that check and the write admits a changed row. The [two-writer practice](/postgres/02-isolation/practice-two-writers) and [MySQL counterpart](/mysql/02-isolation/practice-two-writers) show why a saved literal is not a protected decision. An atomic decrement without the quantity condition expresses arithmetic but does not itself express the nonnegative rule.

**Entailed guarantee†:** with initially nonnegative stock, positive requests, representable arithmetic, and only rule-preserving writers, each successful checked decrement leaves this row nonnegative: it subtracts only when the current target has enough stock. † This is a derivation from the predicate discipline and the [single-row update mechanisms](/postgres/05-patterns/fixing-lost-updates), with the [InnoDB operation scope](/mysql/05-patterns/fixing-lost-updates). No Transcript proves all schedules or those application assumptions.

## Stale edits

**Rule:** a replacement based on an old document revision must not silently erase a newer committed edit. A user edit is not necessarily an additive operation that the application can recompute automatically.

**Assumptions and writers:** the demonstrations use PostgreSQL 18.6 at READ COMMITTED and MySQL 8.4.11 InnoDB at REPEATABLE READ. Both editors read version 1 before their save transactions. Every replacement writer checks the loaded version and advances it on success; versions are not reused or reset, including across delete/recreate operations. Administrative writers and imports must participate too. Version overflow and document identity reuse require application policy beyond this schedule.

**Protection and transaction boundary:** do not keep a database lock open during user think-time. Save in a short transaction, conditioned on the revision originally loaded:

```sql
UPDATE documents
SET body = 'B edit', version = version + 1
WHERE id = 1 AND version = 1;
```

**Demonstrated behavior:** A first saves `A edit` as version 2. B's version-1 save affects zero rows. B rolls back and a fresh read still shows A's text/version. [PostgreSQL evidence](/postgres/05-patterns/checked-writes#an-editing-interval) and [MySQL evidence](/mysql/05-patterns/checked-writes#an-editing-interval) assert that database boundary, then demonstrate the failed repair below. They do not implement an editor or automatic merge. On MySQL the successful version increment changes the row, so either [matched-row or changed-row reporting](/mysql/05-patterns/fixing-lost-updates#fix-3-optimistic-locking-with-a-version-column) distinguishes it from no match.

**Conflict response:** keep the unsaved draft, roll back related work, and fetch current state. A missing row requires a deletion decision. A newer revision requires the user or application to reconsider, merge, or explicitly authorize replacement before a new checked save. Do not turn zero rows into a successful save. Handle waits and transaction errors separately.

**Tempting failed repair:** fetch the latest version and automatically resend the old replacement. The failed-repair branches write B's old draft against version 2 and assert `B edit`, version 3: A's text has been replaced. Raising isolation only around the save does not establish protection for an earlier standalone read. Compare the [PostgreSQL practice](/postgres/02-isolation/practice-two-writers) and [MySQL practice](/mysql/02-isolation/practice-two-writers).

**Limits:** a nonparticipating writer defeats the revision protocol. The predicate detects an unmatched revision or missing row, not whether two texts can be safely merged. [The additive-deposit retry](/postgres/05-patterns/fixing-lost-updates#fix-3-a-version-column-optimistic) deliberately rereads and recomputes an increment; it is not a general instruction to retry human edits blindly. External publication and cross-row rules need their own boundary.

## At least one doctor on call

**Rule:** at least one doctor in the staffing set must remain on call. A request can remove its doctor only if the count is greater than one. Initially the set satisfies the rule. Try the [PostgreSQL staffing practice](/postgres/02-isolation/practice-cross-row) or [MySQL staffing practice](/mysql/02-isolation/practice-cross-row) before reading the worked outcome.

**Assumptions and participating writers:** the evidence uses PostgreSQL 18.6 and MySQL 8.4.11 InnoDB, with two named doctors and one removal per request. Every operation that can reduce the set's on-call count must preserve the same rule, including administration, deletion, bulk changes, and changes of set membership. A count for one set cannot justify a change to another. These Scenarios execute two removals, not those administrative paths. All writers must coordinate on the shared staffing decision, not merely on the different row each writes.

**Protection and transaction boundary:** use one explicit SERIALIZABLE transaction containing the count, application decision, permitted removal, and commit. At a count of one, decline the removal. PostgreSQL uses snapshot reads with SSI dependency monitoring. InnoDB's count SELECT in this explicit transaction takes shared locks; its query/index determines the coverage. Do not split the count and change into separate autocommit transactions. The choice fits this cross-row decision because a correct serial execution of these participating requests preserves the rule; it is not a claim that SERIALIZABLE is always the cheapest protection.

**Demonstrated behavior:** the [PostgreSQL REPEATABLE READ schedule](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew) and [MySQL counterpart](/mysql/02-isolation/serializable#write-skew-at-repeatable-read) each commit both separate-row removals and assert zero on call. Under SERIALIZABLE, [PostgreSQL rejects B's COMMIT with 40001](/postgres/02-isolation/serializable#the-same-interleaving-serializable); [InnoDB with deadlock detection enabled rejects B's UPDATE with 1213](/mysql/02-isolation/serializable#serializable-stops-it-with-locks). A commits, then a fresh B attempt counts one and keeps Bob on call. These fixed schedules do not establish a universal victim or failure point.

**Conflict response:** on PostgreSQL `40001`, discard the aborted attempt and retry the whole transaction with fresh reads and decisions, with a bound, or return controlled failure. An InnoDB deadlock rolls back the whole transaction; apply the same fresh-decision policy for `1213`. Handle [timeouts and other errors](/errors/) according to their own rollback scope. Do not resend only the saved removal or report an aborted attempt as success. The fresh count of one is a business refusal, not a retryable instruction to remove the last doctor. Keep external effects outside a blindly repeated body.

**Tempting failed repair:** rely on REPEATABLE READ plus each UPDATE's lock on its own doctor. That is already the failed separate-row schedule: stable reads and different write targets do not coordinate the aggregate rule. Acquiring only one's own row lock after making the count decision supplies no shared decision boundary.

**Documented contracts:** the [PostgreSQL 18 manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE) states that SSI monitoring “does not introduce any blocking” beyond REPEATABLE READ. Ordinary write and explicit-lock conflicts can still wait. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_serializable) says InnoDB “implicitly converts all plain SELECT statements to SELECT ... FOR SHARE” if autocommit is disabled. The [engine lesson](/mysql/02-isolation/serializable#serializable-stops-it-with-locks) executes the explicit-transaction behavior and the standalone autocommit exception. The [InnoDB error contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html) states: “InnoDB rolls back the entire transaction” for a deadlock.

**Entailed guarantee† and limits:** if the initial set satisfies the rule, every participating transaction preserves it in serial execution, and all relevant changes obey this boundary, serial-equivalent committed execution preserves at least one doctor. † This is a derivation from those assumptions and the linked SERIALIZABLE contracts; no Transcript proves every schedule. Serializable execution cannot correct a transaction that removes the last doctor even when it runs alone. Alternative explicit coordination needs a shared resource and a correct read/check/change protocol for every writer; no additional locking recipe or cost comparison is demonstrated here. The [logical dependency model](/postgres/02-isolation/serializable#logical-dependencies) and [lock-wait model](/mysql/02-isolation/serializable#lock-wait-relationships) describe different relationships, not interchangeable arrows.
