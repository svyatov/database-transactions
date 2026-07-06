# NOWAIT, lock_timeout, SKIP LOCKED

Waiting in the [lock queue](/03-locking/lock-queues) is the default, not the law. PostgreSQL
gives you three ways out, and they answer three different questions:

| Escape hatch | The question it answers |
|---|---|
| `NOWAIT` | "Is it free *right now*? If not, I'll do something else." |
| `lock_timeout` | "I'll wait a little — but I refuse to wait forever." |
| `SKIP LOCKED` | "Give me *any* free row; pretend the locked ones don't exist." |

## NOWAIT: fail fast

<<< ../../scenarios/03-locking/nowait.ts#demo{ts}

<!--@include: ./parts/nowait.md-->

## lock_timeout: bounded patience

<<< ../../scenarios/03-locking/lock-timeout.ts#demo{ts}

<!--@include: ./parts/lock-timeout.md-->

## SKIP LOCKED: the job-queue primitive

<<< ../../scenarios/03-locking/skip-locked.ts#demo{ts}

<!--@include: ./parts/skip-locked.md-->

## Key takeaways

- All three failures speak **SQLSTATE `55P03`** (`lock_not_available`) — `NOWAIT`
  immediately, `lock_timeout` after the timeout. Handle it like `40001`: back off, retry.
- `lock_timeout` applies
  [separately to each lock the statement tries to acquire](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT),
  and it's the seatbelt every [migration](/03-locking/table-locks-and-ddl) should wear.
- `SKIP LOCKED` deliberately returns an inconsistent view — the manual:
  ["skipping locked rows provides an inconsistent view of the data, so this is not suitable for
  general purpose work, but can be used to avoid lock contention with multiple consumers
  accessing a queue-like table"](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
  The patterns chapter builds a [full worker queue](/05-patterns/job-queue) on it.
- A rolled-back worker's row simply reappears for the next taker — crash safety for free.

## Further reading

- [PostgreSQL docs: SELECT — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) —
  NOWAIT and SKIP LOCKED semantics
- [PostgreSQL docs: `lock_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT)
