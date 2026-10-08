# Long and idle transactions

On MySQL 8.4 InnoDB, this schedule opens a REPEATABLE READ transaction, reads two orders, and leaves the connection idle. The queries assert its age, `Sleep` command, and zero modified rows. The artificial `@session_name` tags identify lesson sessions; production attribution needs your own connection identifiers and suitable privileges.

<!--@include: ./parts/find-long-transactions.md-->

`RUNNING` in `innodb_trx` is a transaction state, not proof that a statement is running. The joined processlist supplies the `Sleep` observation. `trx_rows_modified = 0` describes this transaction's modifications, not the age of its read view or a purge diagnosis. The [column manual](https://dev.mysql.com/doc/refman/8.4/en/information-schema-innodb-trx-table.html) defines `TRX_STARTED`: "The transaction start time." It does not report snapshot creation time. An idle transaction can retain [row locks](/mysql/08-production/who-is-blocking-whom), [a read view](/mysql/04-mvcc/history-list-length), or [metadata locks](/mysql/03-locking/table-locks-and-ddl) depending on its earlier operations; this detector does not prove all three for every row.

## The guardrails

<!--@include: ./parts/timeout-guardrails.md-->

The [MySQL 8.4 variable manual](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_max_execution_time) states: "max_execution_time applies to read-only SELECT statements." It excludes SELECTs in stored programs and is not a general statement or transaction deadline. Here, `SLEEP(2)` reports interruption and a later query proves the connection is usable; no exact elapsed time or general timeout-error behavior is asserted.

For noninteractive connections, `wait_timeout` limits idle connection time, including idle pooled connections. The demonstrated one-second setting closes A and rolls back its uncommitted update. It does not distinguish healthy idle connections from idle transactions. Choose settings with pool behavior and reconnection handling in mind. Interactive sessions initialize this timeout differently, as documented under [`wait_timeout`](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_wait_timeout).

For InnoDB row-lock waits, [chapter 3](/mysql/03-locking/nowait-skip-locked) asserts that `1205` leaves earlier work and locks in the explicit transaction when `innodb_rollback_on_timeout=OFF`. The [error-handling manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html) documents transaction rollback with that option enabled. To rerun the whole operation after a timeout, explicitly roll back first. Deadlock `1213` rolls back the transaction. Metadata-lock waits use [`lock_wait_timeout`](/mysql/03-locking/table-locks-and-ddl).

These variables provide different limits; none is a transaction-specific idle deadline like PostgreSQL's `idle_in_transaction_session_timeout`. Use application deadlines and monitoring appropriate to the workload. A `KILL CONNECTION` decision must account for rollback, disconnected clients, and whether retrying application effects is safe.

## Further reading

- [MySQL docs: `information_schema.INNODB_TRX`](https://dev.mysql.com/doc/refman/8.4/en/information-schema-innodb-trx-table.html)
- [The same lesson on PostgreSQL](/postgres/08-production/long-and-idle-transactions)
