# Repeatable Read

The [MySQL 8.4 REPEATABLE READ contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_repeatable-read)
establishes the snapshot at the first **consistent table read**, not necessarily
BEGIN or the first query of any kind. Later consistent SELECTs exclude concurrent
commits after that point. The transaction's own earlier changes remain visible.
START TRANSACTION WITH CONSISTENT SNAPSHOT is a separate documented way to take
the snapshot at transaction start at this level; it is not executed below.

UPDATE, DELETE and locking reads such as SELECT FOR UPDATE/SHARE use current rows
rather than that snapshot. They can wait for conflicting locks, and see the
transaction's own writes. These rules concern InnoDB on MySQL 8.4; the displayed
schedules run on 8.4.11. They do not promise that a write always succeeds.

## One snapshot, no phantoms

B commits 120 after A's BEGIN but before its first consistent SELECT. A includes
120 in its snapshot, excludes B's later 999 and new carol row, and includes its own
change to bob (60). After COMMIT, a new standalone SELECT sees 999, 60, and carol.

<!--@include: ./parts/stable-snapshot.md-->

## Current reads punch holes in the snapshot

A's snapshot reads 100. Its UPDATE uses B's committed 150 to produce 200, which
A's later SELECT sees as its own write. In the second schedule it waits for B's
uncommitted 300 and then produces 350 after B commits.

<!--@include: ./parts/current-reads.md-->

::: warning Porting from PostgreSQL?
For these post-snapshot target-row changes, PostgreSQL REPEATABLE READ rejects the
UPDATE with 40001; see its [executed conflict cases](/postgres/02-isolation/repeatable-read).
InnoDB accepts these current-row UPDATEs. It does not reject them merely because
the earlier snapshot was stale. It can still fail with a deadlock (1213, SQLSTATE
40001), timeout, or constraint error. Do not infer that 40001 never occurs on MySQL.
:::

## Your DELETE and your SELECT live in different worlds

A's DELETE finds no current row with balance 20, yet its consistent SELECT still
sees bob with snapshot balance 20. The Scenario asserts zero deleted rows and the
retained snapshot value; this is not a new-row phantom demonstration.

<!--@include: ./parts/write-predicate-skew.md-->

The [consistent-read manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
documents own-write/current-DML exceptions. A stable snapshot is not a guarantee
that every operation sees the same rows, or that a multi-row business rule survives
concurrent writers. See [lost updates](/mysql/02-isolation/lost-update) and
[write skew](/mysql/02-isolation/serializable). A repair must protect the reads and
decisions before writing, with participation by all relevant writers.

## Reading and locking one row

Try the [reading practice](/mysql/02-isolation/practice-visibility) before reading this section if you want to predict the result.

In this MySQL 8.4.11 InnoDB schedule A's retained consistent read returns 100 after B commits 150. A's SELECT FOR UPDATE returns 150, but its next consistent read still returns 100. A's UPDATE uses current 150 to produce 200, visible to A before commit. B's plain read sees 150 before A commits and 200 afterward.

<!--@include: ./parts/visibility-operations.md-->

<figure class="mechanism">
<div class="mechanism-view" tabindex="0" role="region" aria-label="InnoDB visibility diagram, horizontally scrollable">
<img src="/diagrams/mysql-visibility.svg" alt="InnoDB current record 150 and undo reconstruction of 100: A's consistent read sees 100, locking read sees 150, and own UPDATE becomes visible as 200." width="580" height="700">
</div>
<figcaption>InnoDB current record versus the version reconstructed for A. The upper view is after B's commit; the lower view is after A's UPDATE before its commit. This is a simplified teaching model, not the complete read-view algorithm or an inspected undo chain. Focus the image region and use arrow keys to read any overflow.</figcaption>
</figure>

**Text equivalent:** the clustered record now contains B's committed 150. Undo information can reconstruct the earlier 100 that fits A's retained consistent-read view. A's locking read uses current 150 without refreshing that view. Its next consistent read still returns 100. A's UPDATE adds 50 to current 150, and its own 200 is visible to its later consistent read. Before A commits, B's consistent read still sees committed 150. After commit, B's fresh read sees 200.

**Evidence boundary:** the transcript asserts the returned values and affected rows, not hidden storage fields. The MySQL 8.4 [multi-versioning contract](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html) states: “The roll pointer points to an undo log record written to the rollback segment.” It documents `DB_TRX_ID`, `DB_ROLL_PTR`, and reconstruction for clustered records; secondary indexes have separate behavior. The [undo lesson](/mysql/04-mvcc/undo-logs) distinguishes that contract from executed SQL visibility, and [read views](/mysql/04-mvcc/read-views) gives timing and algorithm limits. The drawing omits rollback, purge, secondary-index lookup, and full visibility checks. Compare [PostgreSQL's heap tuple history](/postgres/02-isolation/repeatable-read#reading-and-locking-one-row); storing history does not give both engines the same locking-read rule.

## Further reading

- [MySQL 8.4: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)
- [MySQL 8.4: START TRANSACTION](https://dev.mysql.com/doc/refman/8.4/en/commit.html)
- [The same lesson on PostgreSQL](/postgres/02-isolation/repeatable-read)
