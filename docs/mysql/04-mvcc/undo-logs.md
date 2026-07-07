# Undo logs: where old row versions live

PostgreSQL keeps old row versions *in the table* — every UPDATE leaves a dead tuple behind
([row versions](/postgres/04-mvcc/row-versions)). InnoDB does the opposite: the table holds
only the **newest** version of each row, and history lives in a separate structure, the
**undo log**. When an older transaction needs an older version, InnoDB rebuilds it on the
fly by walking that row's undo chain backwards.

Every InnoDB row carries the machinery for this, invisible to your queries. Per the
[manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html): "A 6-byte
`DB_TRX_ID` field indicates the transaction identifier for the last transaction that
inserted or updated the row" and "a 7-byte `DB_ROLL_PTR` field called the roll pointer."
The roll pointer is the link into history: "The roll pointer points to an undo log record
written to the rollback segment. If the row was updated, the undo log record contains the
information necessary to rebuild the content of the row before it was updated."

## Reading rows that no longer exist

<!--@include: ./parts/undo-logs.md-->

## DELETE is an UPDATE in disguise

Nothing was physically deleted while R was watching. The manual again: "In the `InnoDB`
multi-versioning scheme, a row is not physically removed from the database immediately when
you delete it with an SQL statement" — instead, "a deletion is treated internally as an
update where a special bit in the row is set to mark it as deleted." The real removal
happens later, in the background: "`InnoDB` only physically removes the corresponding row
and its index records when it discards the update undo log record written for the deletion.
This removal operation is called a purge."

That's the whole MVCC contract in one sentence each: writers publish a new version and
file the old one in undo; readers follow roll pointers back to the version their snapshot
is entitled to; [purge](/mysql/04-mvcc/purge) throws history away once nobody can need it.

## Key takeaways

- The table stores only the current version; history is rebuilt from the **undo log** via
  each row's roll pointer. (PostgreSQL: history stays in the heap; cleanup = VACUUM.)
- Readers never block writers and writers never block readers — reads reconstruct, they
  don't lock.
- DELETE just delete-marks; the row physically disappears only when purge discards its
  undo record.
- Corollary: undo retention is bounded by your **oldest read view** — the subject of
  [the history list](/mysql/04-mvcc/history-list-length).

## Further reading

- [MySQL docs: InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)
- [The PostgreSQL counterpart](/postgres/04-mvcc/row-versions) — same promise, opposite layout
