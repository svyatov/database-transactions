# Who is blocking whom

The most common production page: "everything that touches table X is hanging." Chapter 3
[introduced the monitoring views](/mysql/03-locking/monitoring-locks); this is the
end-to-end incident. Detect, identify, decide, kill:

<!--@include: ./parts/who-is-blocking-whom.md-->

## Reading the output

The queue view (`sys.innodb_lock_waits`) answers the three incident questions in a single
row. Who's stuck? That's `waiting_pid` and its exact statement, the query your users are
watching hang. Who's responsible? That's `blocking_pid`, and the join to the processlist
is the damning part: `command = Sleep`, no statement running. The blocker isn't *doing*
anything; it's an open transaction someone's code forgot to close, still holding
[row locks](/mysql/03-locking/row-locks) it acquired ages ago.

And what now? The view even pre-writes the remediation for you
(`sql_kill_blocking_connection`). `KILL <id>` rolls the blocker's transaction back; the
transcript proves the waiter completes and the blocker's uncommitted work vanishes with it.

`KILL` is the incident-response tool, not the fix. The fix is whatever lets a
transaction sit idle while holding locks.
[The next lesson](/mysql/08-production/long-and-idle-transactions) hunts those down
before anyone gets paged.

The shape to remember: one query names waiter, blocker, and the blocker's state, and a
blocker parked at `command = Sleep` is idle-in-transaction, locks with nobody home. Kill it
and its transaction rolls back, the queue drains, and the waiter's statement finishes on
its own with no retry logic in play. That the fix is a `KILL` and not a code change is the
whole reason the next lesson exists: to find these before the page ever fires.

## Further reading

- [MySQL docs: `sys.innodb_lock_waits`](https://dev.mysql.com/doc/refman/8.4/en/sys-innodb-lock-waits.html)
- [The same lesson on PostgreSQL](/postgres/08-production/who-is-blocking-whom)
