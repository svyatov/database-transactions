---
description: "Seven concurrency-control error codes across PostgreSQL and MySQL (deadlocks, lock-wait timeouts, serialization failures, and statement timeouts), each with a minimal reproduction you can run yourself."
---

# Database error codes, reproduced

You didn't search for "deadlock." You pasted the number your database threw at you. This is the page that answers by that number: for each concurrency-control code below, there's a page with a one-sentence explanation, the shortest reproduction that emits it, and a link to a verified transcript of a real run.

These seven are the transaction-specific codes, the ones you hit because two sessions collided over the same rows, not because a query had a typo. They come in cross-engine pairs, because the underlying situations are the same on both databases even when the numbers aren't.

## The cross-engine pairs

Read across a row to see how PostgreSQL and MySQL each name the same situation.

| What happened | PostgreSQL | MySQL |
|---|---|---|
| Two transactions locked each other in a cycle | [`40P01`](/errors/40P01) deadlock detected | [`1213`](/errors/1213) Deadlock found |
| A statement waited too long for a row lock | [`55P03`](/errors/55P03) lock timeout | [`1205`](/errors/1205) lock wait timeout |
| A `NOWAIT` request refused to queue for a lock | [`55P03`](/errors/55P03) (same code) | [`3572`](/errors/3572) statement aborted |
| A snapshot write lost a race and was refused | [`40001`](/errors/40001) could not serialize access | none; surfaces as `1213` / `1205` instead |
| A statement ran past its time limit | [`57014`](/errors/57014) statement timeout | none; `max_execution_time`, not in the proven set |

The two "none" cells are honest gaps, not omissions. PostgreSQL's snapshot-based `40001` has no lock-based twin in InnoDB, and MySQL's `max_execution_time` isn't exercised by any scenario on this site yet, so no page here claims its code.

## By engine

On PostgreSQL: [`40001`](/errors/40001) · [`40P01`](/errors/40P01) · [`55P03`](/errors/55P03) · [`57014`](/errors/57014).

On MySQL: [`1213`](/errors/1213) · [`1205`](/errors/1205) · [`3572`](/errors/3572).
