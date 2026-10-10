# Repeatable Read

The [PostgreSQL 18 Repeatable Read manual](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)
documents a snapshot established by the first non-transaction-control statement,
not BEGIN. Later queries exclude subsequent commits by other transactions but include
earlier changes made by their own transaction. PostgreSQL prevents non-repeatable
reads and phantoms from concurrent commits at this level. Own writes can still change
your query results; this is not an immutable view of your own work.

## One snapshot, no phantoms

B commits 101 after A's BEGIN but before A's first SELECT, which sees 101. A's later
SELECT excludes B's committed 999 and new carol row, but includes A's own update to
bob. After A commits, its next SELECT sees the committed changes.

<!--@include: ./parts/stable-snapshot.md-->

## The write conflict: SQLSTATE 40001

A's UPDATE targets a row that B changed after A's snapshot. The Scenario asserts
40001 both after B has committed and after A waits for B to commit. In its final
schedule, B rolls back instead, and A's waiting UPDATE succeeds.

<!--@include: ./parts/concurrent-update-40001.md-->

The [manual's updating and locking rules](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)
cover UPDATE, DELETE, MERGE, SELECT FOR UPDATE, and SELECT FOR SHARE: an actual
post-snapshot update or deletion of a target by a committed concurrent transaction
causes this conflict. Merely holding a lock, or changing an unrelated row, does not
establish it. A row absent from the snapshot is not automatically an update target.

On 40001, abandon the failed attempt and retry the whole transaction from the beginning,
including its reads and decisions. A retry can encounter another conflict; it is not a
promise of immediate success. See [the retry pattern](/postgres/05-patterns/retrying-serialization-failures).

The manual calls this implementation snapshot isolation and notes that its stable
view can still be inconsistent with every serial ordering. The
[write-skew and read-only schedules](/postgres/02-isolation/serializable) demonstrate that limit.

## Reading and locking one row

Try the [reading practice](/postgres/02-isolation/practice-visibility) before reading this section if you want to predict the result.

In this PostgreSQL 18.6 schedule A retains 100 after B commits 150. A's SELECT FOR UPDATE fails with 40001. After rollback, A's fresh attempt locks 150 and writes 200. A sees its own uncommitted 200, while B's plain read sees 150 until A commits.

<!--@include: ./parts/visibility-operations.md-->

<figure class="mechanism">
<div class="mechanism-view" tabindex="0" role="region" aria-label="PostgreSQL visibility diagram, horizontally scrollable">
<img src="/diagrams/postgres-visibility.svg" alt="Two PostgreSQL tuple versions: A reads older 100, cannot lock later 150 in that attempt, and reads its own 200 in a fresh attempt." width="580" height="610">
</div>
<figcaption>PostgreSQL tuple history versus the version visible to A. The upper view is after B's commit; the lower view is A's fresh attempt before its commit. This is a simplified teaching model, not the complete tuple-visibility algorithm or a measured heap layout. Focus the image region and use arrow keys to read any overflow.</figcaption>
</figure>

**Text equivalent:** after B commits, the older tuple containing 100 can remain alongside B's tuple containing 150. A's retained snapshot admits 100, not the later committed version. Locking that changed target fails at REPEATABLE READ. A rolls back; a fresh snapshot admits 150. A's next UPDATE creates its own version containing 200, visible to A before commit but not to B's plain read. After commit, B's fresh read sees 200.

**Evidence boundary:** the transcript asserts these SQL values and the locking error. [The row-version lesson](/postgres/04-mvcc/row-versions#watching-an-update-make-a-copy) separately inspects two heap tuples in its own schedule. PostgreSQL 18's [system-column contract](https://www.postgresql.org/docs/18/ddl-system-columns.html#DDL-SYSTEM-COLUMNS-XMIN) states: “each update of a row creates a new row version for the same logical row”. That storage contract explains the drawing; this new schedule does not inspect its physical tuples. Commit/abort status, command order, tuple flags, and other cases also affect visibility, as the [snapshot lesson](/postgres/04-mvcc/snapshots-under-the-hood) explains. Do not treat this picture as an xid-only algorithm. Compare [InnoDB's undo reconstruction](/mysql/02-isolation/repeatable-read#reading-and-locking-one-row).

## Further reading

- [PostgreSQL 18: isolation table](https://www.postgresql.org/docs/18/transaction-iso.html#MVCC-ISOLEVEL-TABLE)
- [The same lesson on MySQL](/mysql/02-isolation/repeatable-read)
