# NOWAIT, lock_timeout, SKIP LOCKED

Waiting in the [lock queue](/postgres/03-locking/lock-queues) is the default, not the law.
PostgreSQL gives you three ways out, and they answer three different questions:

| Escape hatch | The question it answers |
|---|---|
| `NOWAIT` | "Is it free *right now*? If not, I'll do something else." |
| `lock_timeout` | "I'll wait a little — but I refuse to wait forever." |
| `SKIP LOCKED` | "Give me *any* free row; pretend the locked ones don't exist." |

## NOWAIT: fail fast

<!--@include: ./parts/nowait.md-->

## lock_timeout: bounded patience

<!--@include: ./parts/lock-timeout.md-->

## SKIP LOCKED: the job-queue primitive

<!--@include: ./parts/skip-locked.md-->

All three of these speak the same SQLSTATE, `55P03` (`lock_not_available`) — `NOWAIT` raises it
the instant the row is taken, `lock_timeout` raises it once your patience runs out. Handle it the
way you'd handle a `40001` serialization failure: back off and retry. `lock_timeout` in
particular applies
[separately to each lock the statement tries to acquire](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT),
which is what makes it the seatbelt every [migration](/postgres/03-locking/table-locks-and-ddl)
should wear.

`SKIP LOCKED` is the odd one out, because it doesn't fail at all — it lies by omission. The
manual is upfront that this is deliberate: "Skipping locked rows provides an inconsistent view of
the data, so this is not suitable for general purpose work, but can be used to avoid lock
contention with multiple consumers accessing a queue-like table."
([SELECT — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).)
That inconsistency is exactly what a job queue wants: each worker grabs a different free row and
never blocks, and a worker that rolls back puts its row straight back for the next taker, so you
get crash safety for free. The patterns chapter builds a [full worker queue](/postgres/05-patterns/job-queue)
on precisely this.

## Further reading

- [PostgreSQL docs: SELECT — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) —
  NOWAIT and SKIP LOCKED semantics
- [PostgreSQL docs: `lock_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT)
- [The same lesson on MySQL](/mysql/03-locking/nowait-skip-locked)
