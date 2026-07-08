# Advisory locks: locking ideas, not rows

Sometimes the thing you need to serialize isn't a row. "Only one migration at a time",
"one cache rebuild at a time", "one cron instance per task" — there's no table to lock,
because the resource is an *idea*. MySQL's tool for this is the user-level lock:
`GET_LOCK(name, timeout)`.

The [manual](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html): GET_LOCK
"tries to obtain a lock with a name given by the string `str`, using a timeout of
`timeout` seconds. … The lock is exclusive. While held by one session, other sessions
cannot obtain a lock of the same name." It "returns `1` if the lock was obtained
successfully, `0` if the attempt timed out".

<!--@include: ./parts/advisory-locks.md-->

## Session-level only — and that's the sharp edge

The transcript's middle section is the part that bites people: transactions are
irrelevant to these locks. The manual, verbatim: "Locks obtained with `GET_LOCK()` are
not released when transactions commit or roll back." There is no transaction-scoped
variant — PostgreSQL has both
([`pg_advisory_lock` and `pg_advisory_xact_lock`](/postgres/05-patterns/advisory-locks));
MySQL gives you session-scoped or nothing. Release paths, per the manual: "released
explicitly by executing `RELEASE_LOCK()` or implicitly when your session terminates
(either normally or abnormally)."

The implicit release is the crash-safety story: a deploy runner that dies takes its
session — and its `migration` lock — with it. But it's also the connection-pool trap: a
*pooled connection doesn't terminate* when your request ends. Forget to release, return
the connection to the pool, and the lock lives on in a healthy idle session that no code
remembers owning. With a pool, always release in a `finally`, or pin the lock to a
dedicated connection.

A few operational notes worth keeping. `GET_LOCK(name, 0)` is a try-lock, a positive
timeout is a bounded wait that returns `0` rather than erroring when it expires, and `-1`
waits forever. The locks are session-scoped, so COMMIT and ROLLBACK never touch them and
only a disconnect or crash releases them — which, with pooled connections, means nothing
auto-releases, so reach for `finally`. `IS_FREE_LOCK` peeks without taking,
`RELEASE_ALL_LOCKS()` returns how many locks it dropped, and because names are
server-global you'll want to prefix them (`myapp:migration`) on a shared server.

## Further reading

- [MySQL docs: Locking Functions](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/advisory-locks)
