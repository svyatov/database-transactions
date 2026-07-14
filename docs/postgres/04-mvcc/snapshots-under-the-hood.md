# Snapshots under the hood

[Chapter 2](/postgres/02-isolation/snapshots-and-the-four-levels) treated the snapshot as a black
box: "a frozen view of committed data". Here's the box, opened. A snapshot is three numbers, and
every visibility decision (every row you do or don't see) is arithmetic on them plus the
`xmin`/`xmax` stamps from the [previous lesson](/postgres/04-mvcc/row-versions).

| component | meaning |
|---|---|
| `xmin` | the oldest xid still running when the snapshot was taken, everything below is settled (committed or rolled back) |
| `xmax` | one **past** the highest *completed* xid, everything at or above hadn't finished, so it's invisible |
| `xip` | the xids between the two that were still **in progress** at snapshot time: invisible, forever, in this snapshot |

A row version is visible if its `xmin` is committed, below `xmax`, and not in `xip`, and its
`xmax` (if set) fails that same test. Notice what's absent from the rule: the current time.
Whether the creator commits a nanosecond or an hour after the snapshot was taken changes nothing.

## The three numbers, live

<!--@include: ./parts/snapshots-under-the-hood.md-->

Three beats reward a second look. The first is that xids are handed out lazily: A's transaction
had *no* xid until its first write, because assignment
["happens when a transaction first writes to the database"](https://www.postgresql.org/docs/current/transaction-id.html).
Read-only transactions never consume one, which is why monitoring columns like `backend_xid` are
so often null for busy read-only sessions, and why the workloads that burn through xids are the
write-heavy ones.

The second: `xmax` is one past the highest *completed* xid, not the next id to be assigned. A got
its xid before B, yet sits at `xmin`, below `xmax`, alive in `xip`: the three numbers bracket
exactly the region where "did this commit?" is still ambiguous.

The third is the punchline: commit doesn't matter, because the snapshot already decided. A commits
mid-scenario and C's verdict doesn't budge. That reframes the whole of chapter 2: the isolation
levels are nothing but retention policies for this one object.
[Read Committed](/postgres/02-isolation/read-committed) takes a fresh snapshot per statement;
[Repeatable Read](/postgres/02-isolation/repeatable-read) keeps one for the whole transaction. Same
arithmetic, different lifetime.

That's the lever, then: inspect your own snapshot with
[`pg_current_snapshot()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT),
and remember that visibility is pure arithmetic on xids: no clocks, no "latest committed value"
lookup. It's why MVCC reads are cheap, and also why old snapshots are expensive: someone has to
keep every version they might still need, which is the whole problem the
[long-transactions lesson](/postgres/04-mvcc/long-transactions) picks apart next.

## Further reading

- [PostgreSQL docs: Transaction ID and Snapshot Information Functions](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT)
- [PostgreSQL docs: Transactions and Identifiers](https://www.postgresql.org/docs/current/transaction-id.html)
- [PostgreSQL docs: Introduction to MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [The same lesson on MySQL](/mysql/04-mvcc/read-views)
