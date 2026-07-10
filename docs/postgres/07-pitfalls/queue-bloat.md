# A hung worker turns queue throughput into disk

Here's the incident. Your job queue's table is many times the size of the rows it holds: a few
thousand live jobs, gigabytes on disk. Autovacuum is running, on schedule, no errors in the log.
The monitoring dashboard is green. And the table keeps growing.

The [long transactions lesson](/postgres/04-mvcc/long-transactions) proved the mechanism behind
this: one open transaction holds the vacuum horizon back, and VACUUM reclaims nothing behind it.
What that lesson didn't do is put a meter on the cost. A queue is a churn engine. Every job is a
[claim with `FOR UPDATE SKIP LOCKED`](/postgres/05-patterns/job-queue), a completion `UPDATE`, and
a `COMMIT`, so one worker that hangs mid-job turns the whole queue's *throughput* into growth
nobody can reclaim until it lets go. The bill isn't set by how many jobs are stuck. It's set by how
many drained past the one that is.

## Watch the meter climb

<!--@include: ./parts/queue-bloat.md-->

Session A is the stuck worker: it claims job 1 and never commits. A slow HTTP call, a debugger
breakpoint, a `BEGIN` an ORM forgot to close — the cause doesn't matter, only that the transaction
stays open. B is every other worker, healthy, running the taught loop. The first cycle shows the
pattern in the open: B skips A's locked job 1 (that's [SKIP
LOCKED](/postgres/03-locking/nowait-skip-locked) earning its keep), claims job 2, marks it done,
commits. One dead row version left behind, the old `'queued'` tuple of job 2.

Then B runs that same body a thousand more times through `drain`, a procedure holding the identical
three statements. The page count is the meter: 9 pages before, 11 after 250 cycles, 17 after 750
more. The table hasn't gained a single live row — it's still 1200 jobs — but every completed cycle
left a dead version A's snapshot might still need, and not one can go while A holds the horizon.
Count the occupied line pointers across the pages and there they are: 1200 live plus 1001 dead,
2201 in all.

`VACUUM jobs` runs, reports success, and frees none of it. The line-pointer count doesn't budge.
That's the failure mode's cruelest trick: the vacuum *worked*, which is exactly why the dashboard
stays green while the disk fills. VACUUM is obeying its one rule, and the manual states it plainly:
["The standard form of VACUUM removes dead row versions in tables and indexes and marks the space
available for future reuse."](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
It removes *dead* versions, and A's snapshot is what keeps these ones alive. The instant A commits,
the identical `VACUUM jobs` reclaims all 1001 and the count drops back to 1200. The whole freeze
was one worker's grip on a snapshot, and ending the transaction ends it.

## The file stays big anyway

One number never moved through any of this: the page count. Seventeen pages after the drain,
seventeen after the reclaiming VACUUM. VACUUM marked the dead space reusable inside the file; it
didn't return it to the operating system. The only thing that does is [`VACUUM
FULL`](/postgres/04-mvcc/vacuum), which rewrites the whole table under an `ACCESS EXCLUSIVE` lock,
and the manual itself counsels against reaching for it here: ["Although VACUUM FULL can be used to shrink a table back to its minimum size and
return the disk space to the operating system, there is not much point in this if the table will
just grow again in the future."](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
A queue will. So the disk you bought during the hang stays bought, held in reserve for the next
batch of jobs. This is also why `pg_relation_size` alone can't diagnose the bug: it reads the same
17 whether those pages are dead weight or free space waiting for reuse. The line-pointer count is
what tells the two apart.

## The fix is upstream

You don't fix this with vacuum tuning. You fix it by not holding the transaction. The [job queue
lesson](/postgres/05-patterns/job-queue) already names the trade: for jobs that run longer than a
few seconds, drop the claim-is-the-lease design and claim by state instead, with `UPDATE ... SET
state = 'running', claimed_at = now()` in one short transaction plus a reaper that requeues stale
claims. That caps how long any worker can pin the horizon, at the price of the automatic crash
safety the lease handed you for free.

And catch it long before 3am: chapter 8's [bloat & vacuum
health](/postgres/08-production/bloat-and-vacuum-health) turns the line-pointer gap you just
watched into a graph and an alert, so a queue drifting under a stuck worker shows up as a slope on
a dashboard instead of a disk-full page at midnight.

## Further reading

- [PostgreSQL docs: Recovering Disk Space](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [The mechanism, without the price: long transactions block VACUUM](/postgres/04-mvcc/long-transactions)
- [The pattern this prices: a job queue on FOR UPDATE SKIP LOCKED](/postgres/05-patterns/job-queue)
