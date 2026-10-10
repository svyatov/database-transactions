# Advisory locks: locking ideas, not rows

MySQL's `GET_LOCK(name, timeout)` lets cooperating clients serialize work under an agreed name without locking a table row. In this schedule, the name is `migration`. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_get-lock) states: "The lock is exclusive." Code that does not acquire that name is not protected by it.

<!--@include: ./parts/advisory-locks.md-->

## Session-level only, and that's the sharp edge

A acquires the name. B's attempts with timeouts 0 and 1 return 0 while A holds it; the scenario asserts those results, not elapsed time. A's COMMIT does not release the name. After A calls `RELEASE_LOCK`, B obtains it, acquires a second name, and releases both with `RELEASE_ALL_LOCKS`.

The [manual's release contract](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_get-lock) says: "Locks obtained with `GET_LOCK()` are not released when transactions commit or roll back." It also documents release when the session terminates and infinite waiting for a negative timeout. These are Documented contracts; this scenario does not terminate a session, roll back, or exercise a negative timeout. A lock acquisition can return NULL on error, and a user-lock deadlock raises `ER_USER_LOCK_DEADLOCK` without rolling back the transaction. Do not treat every result as a successful acquisition or apply the InnoDB `1213` rule to that separate error.

**Entailed guarantee†:** returning a still-open connection to a pool does not end its session, so it does not release that session's named locks. † This follows from the documented release boundary, not a pool execution here. Keep acquisition and release on the same physical connection, check acquisition, and release in `finally`. Handle cleanup failure before returning the connection for reuse. A dedicated connection still needs a release or termination path; a dead client is not a measured prompt-release guarantee.

Names are server-wide, so prefix them for the application on a shared server. `IS_FREE_LOCK` reports availability at the time of the query; it does not reserve a lock. A session can acquire the same name more than once, and all acquisitions must be released before another session can obtain it, as documented in the same manual section.

## Further reading

- [MySQL docs: Locking Functions](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/advisory-locks)
