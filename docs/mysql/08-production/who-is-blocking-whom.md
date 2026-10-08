# Who is blocking whom

On MySQL 8.4 InnoDB, the controlled incident has one blocker A and one waiter B. The query identifies their connections and asserts that A's processlist command is `Sleep` with no current statement. This is a row-lock demonstration; [metadata-lock diagnosis](/mysql/03-locking/table-locks-and-ddl) uses different state.

<!--@include: ./parts/who-is-blocking-whom.md-->

## Reading the output

`waiting_pid`, `waiting_query`, and `blocking_pid` identify this wait edge. `Sleep` alone means an idle connection; combined here with a blocking InnoDB lock, it identifies an idle transaction holding that lock. It does not establish why the application left it open or how long every lock has been held.

The [MySQL view manual](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html) lists `sql_kill_blocking_connection` as a generated statement to terminate the blocking session. The example executes `KILL CONNECTION` through a helper that uses lesson session tags. B's waiting update completes and its separate read of row 2 observes A's change rolled back. The final row 1 value alone would not establish that rollback, because B overwrites the same row.

This proves recovery for the demonstrated edge, not drainage of every production queue. Other blockers, rollback time, deadlocks, and client retries can change recovery. Check authorization and application effects before terminating a real connection; `KILL QUERY` is a different operation. The [KILL manual](https://dev.mysql.com/doc/refman/8.4/en/kill.html) states: "KILL CONNECTION is the same as KILL with no modifier". Termination and rollback need not complete immediately.

Correct the application path that retains the transaction. The [long-transaction detector](/mysql/08-production/long-and-idle-transactions) helps find candidates; it does not automatically decide which sessions are safe to end.

## Further reading

- [MySQL docs: `sys.innodb_lock_waits`](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The same lesson on PostgreSQL](/postgres/08-production/who-is-blocking-whom)
