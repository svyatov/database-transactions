---
description: Which track to read, where to jump in given what you already know, how to run it yourself, and why you can trust it — the shortest path into a site about database transactions.
---

# Start here

Four questions, four links. Pick the ones that apply to you and go.

## Which track: PostgreSQL or MySQL?

Read the track for the engine you already work with. Transactions look reasonable in the
abstract and get strange in the specifics, and the specifics are what your production database
will hand you at 3am.

If you're undecided, or you're learning this topic rather than shipping on a particular stack,
start with [PostgreSQL](/postgres/01-basics/what-is-a-transaction). Its snapshot model makes
the isolation lessons visible: each transaction gets a consistent view of the database, and the
anomalies show up as clean, explainable differences between what two sessions see. Once that
clicks, the [MySQL track](/mysql/01-basics/what-is-a-transaction) teaches you the contrasts —
current reads that step outside the snapshot, locking that bites in different places, deadlocks
that arrive more often than you'd like. The other track is always one click away in the nav.

## Where do I jump in?

Three readers, three doors.

- **New to transactions.** Read the [concepts overview](/concepts/) for the engine-neutral
  theory — what ACID actually promises, what the isolation levels trade away — then start the
  [PostgreSQL basics](/postgres/01-basics/what-is-a-transaction).
- **Comfortable with `BEGIN` and `COMMIT`.** Skip ahead to chapter 2,
  [snapshots and the four isolation levels](/postgres/02-isolation/snapshots-and-the-four-levels)
  ([MySQL](/mysql/02-isolation/snapshots-and-the-four-levels)). This is the heart of the
  material and where most of the surprises live.
- **Here to run it, not read it.** Go straight to [running it locally](/about/run-locally).

The eight chapters in the sidebar run in order, so wherever you enter, forward is the way out.

## How do I run it myself?

Clone the repo, bring up the databases, and every lesson on this site replays live in your own
terminal — pausing between steps so you can watch two sessions collide. Two containers and one
command: [run it locally](/about/run-locally).

## Why trust any of this?

Because none of it is a claim. Every scenario runs against a real PostgreSQL and a real MySQL,
and every transcript you read was generated from that run — then re-proven in CI through a
second, completely independent pair of drivers, so a claim only stands when both agree. The
machinery is documented in [how this site works](/about/methodology).
