# Snapshots under the hood

[Chapter 2](/02-isolation/snapshots-and-the-four-levels) treated the snapshot as a black
box: "a frozen view of committed data". Here's the box, opened. A snapshot is just **three
numbers**, and every visibility decision — every row you do or don't see — is arithmetic
on them plus the `xmin`/`xmax` stamps from the
[previous lesson](/04-mvcc/row-versions).

| component | meaning |
|---|---|
| `xmin` | the oldest xid still running when the snapshot was taken — everything below is settled (committed or rolled back) |
| `xmax` | one **past** the highest *completed* xid — everything at or above hadn't finished, so it's invisible |
| `xip` | the xids between the two that were still **in progress** at snapshot time — invisible, forever, in this snapshot |

A row version is visible if its `xmin` is committed, below `xmax`, not in `xip` — and its
`xmax` (if set) is *not* visible by the same test. Note what's missing from the rule:
**the current time**. Whether the creator commits a nanosecond or an hour after the
snapshot was taken changes nothing.

## The three numbers, live

<<< ../../scenarios/04-mvcc/snapshots-under-the-hood.ts#demo{ts}

<!--@include: ./parts/snapshots-under-the-hood.md-->

Worth pausing on each beat:

- **xids are handed out lazily.** A's transaction had *no* xid until its first write — the
  manual: xid assignment
  ["happens when a transaction first writes to the database"](https://www.postgresql.org/docs/current/transaction-id.html),
  so read-only transactions never consume one. (That's why monitoring columns like
  `backend_xid` are often null for busy read-only sessions, and why xid-hungry workloads
  are write-heavy ones.)
- **`xmax` is one past the highest *completed* xid** — not the next to be assigned. A was
  assigned its xid *before* B, yet sits at `xmin`, below `xmax`, alive in `xip`. The three
  numbers bracket exactly the region where "committed?" is ambiguous.
- **Commit doesn't matter; the snapshot already decided.** A commits mid-scenario and C's
  verdict doesn't budge. The isolation levels of chapter 2 are nothing but *retention
  policies* for this object: [Read Committed](/02-isolation/read-committed) takes a fresh
  snapshot per statement, [Repeatable Read](/02-isolation/repeatable-read) keeps one for
  the whole transaction. Same arithmetic, different lifetime.

## Key takeaways

- A snapshot = `xmin` / `xmax` / `xip` — inspect your own with
  [`pg_current_snapshot()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT).
- Visibility is pure arithmetic on xids; no clocks, no "latest committed value" lookup.
  This is why MVCC reads are cheap — and why old snapshots are expensive: someone must
  keep every version they might still need
  ([long transactions](/04-mvcc/long-transactions)).
- Every isolation-level behavior you saw in chapter 2 reduces to *when a new snapshot is
  taken*.

## Further reading

- [PostgreSQL docs: Transaction ID and Snapshot Information Functions](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT)
- [PostgreSQL docs: Transactions and Identifiers](https://www.postgresql.org/docs/current/transaction-id.html)
- [PostgreSQL docs: Introduction to MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html)
