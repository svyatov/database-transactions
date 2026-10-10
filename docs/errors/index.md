---
description: "Seven concurrency-control error codes across PostgreSQL and MySQL (deadlocks, lock-wait timeouts, serialization failures, and statement timeouts), each with a minimal reproduction you can run yourself."
---

# Database error codes, reproduced

You didn't search for "deadlock." You pasted the number your database threw at you. This is the page that answers by that number: for each concurrency-control code below, there's a page with a one-sentence explanation, the shortest reproduction that emits it, and a link to a verified transcript of a real run.

These seven are reproduced here, not an exhaustive error list. Statement timeout can occur without another session. Similar symptoms across engines do not imply identical rollback scope, timing, or recovery.

## The cross-engine pairs

Read across a row for related symptoms, then follow the page for operation and configuration limits. The SQL snippets are schedule excerpts; their linked full Scenarios contain setup and assertions.

| What happened | PostgreSQL | MySQL |
|---|---|---|
| Two transactions locked each other in a cycle | [`40P01`](/errors/40P01) deadlock detected | [`1213`](/errors/1213) Deadlock found |
| A statement waited too long for a row lock | [`55P03`](/errors/55P03) lock timeout | [`1205`](/errors/1205) lock wait timeout |
| A `NOWAIT` request refused to queue for a lock | [`55P03`](/errors/55P03) (same code) | [`3572`](/errors/3572) statement aborted |
| A post-snapshot target change or serialization dependency rejects an attempt | [`40001`](/errors/40001) serialization failure | no identical snapshot rule; [`1213`](/errors/1213) also has SQLSTATE 40001 |
| A statement ran past its time limit | [`57014`](/errors/57014) statement timeout | none; `max_execution_time`, not in the proven set |

InnoDB SERIALIZABLE locking is not PostgreSQL's snapshot/SSI conflict rule. Waits can succeed or fail, so this comparison does not predict a MySQL error for every PostgreSQL 40001 schedule. MySQL's SELECT-limit error 3024 is documented but not emitted here; the timeout Scenario asserts SLEEP interruption. Recovery of a failed PostgreSQL BEGIN block differs from InnoDB statement rollback and configuration-dependent timeout rollback.

## By engine

On PostgreSQL: [`40001`](/errors/40001) · [`40P01`](/errors/40P01) · [`55P03`](/errors/55P03) · [`57014`](/errors/57014).

On MySQL: [`1213`](/errors/1213) · [`1205`](/errors/1205) · [`3572`](/errors/3572).
