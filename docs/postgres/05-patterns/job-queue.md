# A job queue on `FOR UPDATE SKIP LOCKED`

At READ COMMITTED, two workers select different available rows, and an explicit
rollback makes one selected job available again. This is Demonstrated behavior
for the database queue below. It does not execute the email or invoice named in
the task column, kill a worker process, or prove duplicate-free external effects.

Keep the selection and database-local completion update in one transaction:

<!--@include: ./parts/job-queue.md-->

A selects job 1; B skips that locked row and selects job 2. A commits `done`.
B explicitly rolls back, then selects job 2 again and commits `done`.
The final query asserts both database states. It does not count task executions.

The PostgreSQL 18 [locking-clause contract](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE)
permits this queue use but warns that SKIP LOCKED gives an inconsistent view.
It skips conflicting row locks, not table locks or every possible wait.
`ORDER BY id` orders available rows; it does not promise global FIFO fairness
when an earlier row is locked. All workers must use the same selection and
completion protocol in a transaction.

## The transaction is the lease

The row lock lasts until transaction end. PostgreSQL's
[session-termination contract](https://www.postgresql.org/docs/18/protocol-flow.html#PROTOCOL-FLOW-TERMINATION)
rolls back an open transaction when the connection ends. This scenario uses
ROLLBACK instead of testing process or server failure. Even after rollback,
an email already sent cannot be undone by this database transaction.

Keep transactions short. An old snapshot can delay reclamation of relevant row
versions, as [chapter 4](/postgres/04-mvcc/long-transactions) explains; an open
READ COMMITTED transaction alone does not establish that it retains such a
snapshot. The [queue-bloat case](/postgres/07-pitfalls/queue-bloat) measures a
particular hung-worker schedule. A claimed-state queue with stale-claim recovery
is a different design, not verified here.

The [outbox relay](/postgres/06-distributed/transactional-outbox) uses this row
selection pattern. Its database transaction protects queue state, while external
delivery needs a separate retry and deduplication policy.

## Further reading

- [PostgreSQL 18: The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [The same lesson on MySQL](/mysql/05-patterns/job-queue)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-patterns) records the exact manual support and execution limits for this lesson.
