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

## Further reading

- [PostgreSQL 18: isolation table](https://www.postgresql.org/docs/18/transaction-iso.html#MVCC-ISOLEVEL-TABLE)
- [The same lesson on MySQL](/mysql/02-isolation/repeatable-read)
