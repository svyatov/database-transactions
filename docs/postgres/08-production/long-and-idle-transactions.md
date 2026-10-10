# Long & idle transactions

An open transaction can retain locks or an old cleanup horizon, and it occupies its connection until it ends. Those are separate diagnostics: not every idle transaction retains a snapshot, and connection-pool exhaustion is not measured here. This PostgreSQL 18.6 Scenario finds one idle READ ONLY REPEATABLE READ report.

## Finding them

<!--@include: ./parts/find-long-transactions.md-->

The report reads two orders, then pauses. All three queries identify A: its transaction is older than one second, its state is `idle in transaction`, and it retains `backend_xmin` without an assigned `backend_xid`. The manual calls `backend_xmin` the "current backend's xmin horizon" in [pg_stat_activity](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW). A missing top-level xid is not a general proof that a session never wrote: xid assignment and write counts are different things.

This Scenario observes the horizon but executes no VACUUM. The [REPEATABLE READ reclamation case](/postgres/04-mvcc/long-transactions) demonstrates affected tuple slots; the [READ COMMITTED queue case](/postgres/07-pitfalls/queue-bloat) asserts an assigned xid rather than a transaction-wide snapshot. Sort by age to find candidates, then inspect state, locks, `backend_xmin`, and `backend_xid`. The oldest `xact_start` alone does not identify every cause of blocked cleanup.

## Guardrails: make the database enforce it

<!--@include: ./parts/timeout-guardrails.md-->

- `statement_timeout` emits `57014`. The standalone statement leaves the session usable. The explicit-transaction case emits `25P02` on the next query until ROLLBACK, after which M reads the original balance 100. Session survival does not mean transaction survival.
- `idle_in_transaction_session_timeout` terminates an idle session with an open transaction. The separate [ORM-pitfalls Scenario](/postgres/05-patterns/orm-pitfalls) demonstrates termination; no ORM runs there.
- `transaction_timeout`, available since PostgreSQL 17, terminates a session whose transaction exceeds its limit. Here A is idle after an update: M observes no A backend and balance 100. Bun reports a closed connection; psycopg can receive `25P04`. This run does not exercise a continuously busy transaction or prepared work.

Documented scope: PostgreSQL 18's [timeout contracts](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-STATEMENT-TIMEOUT) apply to explicit and implicit transactions as specified. A shorter or equal `transaction_timeout` supersedes a longer statement or idle-in-transaction timeout. The manual states: "Prepared transactions are not subject to this timeout". Default zero disables each of these timeouts.

Operational advice: size role-specific limits for the application's work and recovery policy. Termination loses the session and rolls back its open database work; it does not undo external effects or resolve [prepared transactions](/postgres/06-distributed/two-phase-commit). Check connection-pool handling of server-closed connections before rollout. These settings bound work or waits; they do not guarantee that incidents cannot occur.

## Further reading

- [PostgreSQL 18: Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-STATEMENT-TIMEOUT)
- [PostgreSQL 18: pg_stat_activity](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)
- [The same lesson on MySQL](/mysql/08-production/long-and-idle-transactions)
