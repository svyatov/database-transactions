# Who is blocking whom

The most common production page: "everything that touches table X is hanging." Chapter 3
[introduced the monitoring views](/mysql/03-locking/monitoring-locks); this is the
end-to-end incident — detect, identify, decide, kill:

<!--@include: ./parts/who-is-blocking-whom.md-->

## Reading the output

The queue view (`sys.innodb_lock_waits`) answers the three incident questions in one row:

- **Who's stuck?** `waiting_pid` and its exact statement — what your users are
  experiencing.
- **Who's responsible?** `blocking_pid` — and the join to the processlist is the
  damning part: `command = Sleep`, no statement running. The blocker isn't *doing*
  anything; it's an open transaction someone's code forgot to close, holding
  [row locks](/mysql/03-locking/row-locks) it acquired ages ago.
- **What now?** The view even generates the remediation
  (`sql_kill_blocking_connection`). `KILL <id>` rolls the blocker's transaction back —
  the transcript proves the waiter completes and the blocker's uncommitted work
  vanishes.

`KILL` is the incident-response tool, not the fix. The fix is whatever lets a
transaction sit idle while holding locks —
[the next lesson](/mysql/08-production/long-and-idle-transactions) hunts those down
before anyone gets paged.

## Key takeaways

- One query — `sys.innodb_lock_waits` joined to the processlist — names waiter, blocker,
  and the blocker's state.
- A blocker with `command = Sleep` is idle-in-transaction: locks with nobody home. Kill
  it; its transaction rolls back and the queue drains.
- The waiter needs no retry logic for the kill case — its statement simply completes
  once the lock frees.

## Further reading

- [MySQL docs: `sys.innodb_lock_waits`](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The same lesson on PostgreSQL](/postgres/08-production/who-is-blocking-whom)
