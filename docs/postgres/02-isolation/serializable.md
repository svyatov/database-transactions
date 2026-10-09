# Serializable

For a prediction task, open [the staffing practice](/postgres/02-isolation/practice-cross-row) before reading the explanations below.

Two REPEATABLE READ transactions can both read two on-call doctors, then update
different rows and commit, leaving none on call. That is the
[write-skew problem](/concepts/write-skew). Stable snapshots alone do not protect this rule.

The [PostgreSQL 18 Serializable manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE)
documents serial-equivalent execution for committed SERIALIZABLE transactions. A
business rule is protected by this contract only when each transaction preserves
it in serial execution and all relevant writers participate. Constraints or suitable
explicit locking can protect some rules at weaker levels too.

PostgreSQL uses Serializable Snapshot Isolation: snapshot reads plus monitoring of
dependencies that can make the execution non-serializable. Detection can cause 40001
at a statement or COMMIT. The contract does not specify a universal winning session
or promise that the first committer always wins.

## Why REPEATABLE READ isn't enough: write skew

Both displayed transactions commit and the final asserted on-call count is zero.

<!--@include: ./parts/write-skew-rr.md-->

## The same interleaving, SERIALIZABLE

In this schedule A commits, B's COMMIT fails with 40001, and one doctor remains.
B's fresh transaction then asserts one on-call doctor and leaves that doctor on call.

<!--@include: ./parts/write-skew-serializable.md-->

## Logical dependencies

<figure class="mechanism">
<div class="mechanism-view" tabindex="0" role="region" aria-label="Scrollable PostgreSQL logical dependency model">
<img src="/diagrams/postgres-serialization-dependencies.svg" alt="Dashed logical edges require A before B because A read Bob on call, and B before A because B read Alice on call. These edges are not lock waits." />
</div>
<figcaption>Reader-to-writer logical ordering in the on-call schedule. Dashed open arrows are serialization dependencies, not blocked statements. This is a teaching model, not PostgreSQL's complete SSI detection algorithm or a captured internal graph.</figcaption>
</figure>

**Text equivalent:** A's read of Bob's old on-call status requires A before B's removal in a serial explanation. B's read of Alice's old status requires B before A's removal. The cycle leaves no such serial ordering for both completed removals. The [asserted REPEATABLE READ run](#why-repeatable-read-isn-t-enough-write-skew) commits both; the [SERIALIZABLE run](#the-same-interleaving-serializable) rejects B with 40001 at COMMIT. The edges explain those SQL observations; the Scenario does not inspect SSI tracking structures.

**Documented contract:** the [PostgreSQL 18 manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE) says predicate locks “do not cause any blocking”. A logical dependency therefore need not mean a lock wait. Ordinary row/table lock conflicts still apply. Compare the separate [InnoDB lock-wait picture](/mysql/02-isolation/serializable#lock-wait-relationships): its solid arrows point from waiter to holder, rather than from reader to logical writer. Neither picture replaces the generated session timelines.

For the business-rule assumptions and conflict policy, use the [on-call worked decision](/concepts/protection-choices#at-least-one-doctor-on-call).

## It even protects read-only transactions

In the REPEATABLE READ schedule, the report reads the closed-batch marker and two
receipts before a third receipt commits into that batch. No serial ordering explains
all three transactions' reads and writes: the cashier's old-marker read requires it
before the closer, while the report's new marker puts it after the closer and its
missing receipt puts it before the cashier. With all three SERIALIZABLE, this schedule
rejects the cashier at COMMIT. No cashier retry is executed in this Scenario.

<!--@include: ./parts/read-only-anomaly.md-->

## Living with SERIALIZABLE

::: warning Handle 40001 explicitly
An aborted attempt has not completed the requested work. Either retry the whole
transaction with fresh reads and decisions or return a controlled failure. Do not
report the operation as committed. Retries need a policy for repeated failures.
:::

The [Serializable manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE)
documents that even a read-only transaction can encounter serialization failure.
Do not use its results as valid until it commits. Predicate-lock tracking can be
conservative; combining locks due to resource limits can increase failures. These
Scenarios do not measure that overhead or establish a performance tuning rule.

The [SET TRANSACTION manual](https://www.postgresql.org/docs/18/sql-set-transaction.html#SQL-SET-TRANSACTION-DESCRIPTION)
documents SERIALIZABLE READ ONLY DEFERRABLE: acquisition of a safe snapshot can wait,
after which serialization-failure cancellation is avoided. That is not immunity
from timeouts, connection loss, or other errors, and is not executed here.

SSI monitoring adds no blocking beyond REPEATABLE READ, according to the isolation
manual. Normal row and table locks still apply. Retry bodies must account for
effects outside the database transaction; rollback cannot undo an email or HTTP effect.

## Further reading

- [PostgreSQL 18: Serializable](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE)
- [PostgreSQL SSI examples](https://wiki.postgresql.org/wiki/SSI)
- [The same lesson on MySQL](/mysql/02-isolation/serializable)
