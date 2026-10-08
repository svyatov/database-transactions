# A job queue on `FOR UPDATE SKIP LOCKED`

This recipe claims a queued row inside a transaction, changes its state, and commits. In the demonstrated MySQL 8.4 InnoDB schedule, worker B skips worker A's locked job and selects the next one. The [manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) states: "`NOWAIT` and `SKIP LOCKED` only apply to row-level locks." They do not remove every possible wait, including metadata-lock waits.

<!--@include: ./parts/job-queue.md-->

## Why each piece matters

`FOR UPDATE` takes the row lock used as the claim. `SKIP LOCKED` excludes locked rows from this locking read. `ORDER BY id LIMIT 1` selects the lowest eligible id among the rows the query can return. Skipped jobs can be selected later; this does not prove fairness or prevent starvation.

B's failure here is an explicit `ROLLBACK`, not a killed process or a database crash. After that rollback B can select job 2 again, and both jobs finish in state `done`. The task strings mention email and invoices, but no email or invoice service is called. A repeated selection does not establish exactly-once execution of external work.

**Entailed guarantee†:** cooperating workers that use this locking claim and update database-local work and job state in the same transaction keep those database effects inside one commit boundary. Rollback removes those changes and releases the transaction's locks. † This follows from [InnoDB locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) and [rollback](/mysql/01-basics/begin-commit-rollback); the transcript executes one rollback schedule, not all failure paths.

Keep the transaction short. A stalled transaction can retain its claim until it ends; process death does not specify how quickly the server detects a lost connection. For work outside the database, design retry and deduplication separately, as in the [outbox lesson](/mysql/06-distributed/transactional-outbox).

The [manual's locking-read discussion](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) limits `SKIP LOCKED` to cases that tolerate an incomplete view, such as queue-like tables. Query plans and indexes also affect which locks are taken. If claimers deadlock, inspect their lock footprints and [retry the deadlock victim](/mysql/05-patterns/retrying-deadlocks). READ COMMITTED changes [gap-lock behavior](/mysql/03-locking/gap-locks); it is not a promise of deadlock-free workers.

## Further reading

- [MySQL docs: Locking Read Concurrency with NOWAIT and SKIP LOCKED](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/job-queue)
