# How this site works

A hands-on guide to database transactions (isolation levels, anomalies, locking, MVCC, and
the concurrency patterns that survive production) for PostgreSQL and MySQL, side by side.
Every lesson is built around a transcript of real sessions racing each other, so you see the
anomaly happen (and the fix work) instead of reading that it would.

It was built because learning this topic usually means piecing it together yourself: an
article here, a conference talk there, the official manual open in a third tab to check which
parts apply to *your* database and version. This site is an attempt to put the whole picture
in one place and hold it to one rule: *nothing here is claimed — everything is demonstrated.*
The rest of this page is the machinery that keeps that promise.

## Every lesson is an executable scenario

Each demo you see is a YAML file in
[`scenarios/`](https://github.com/svyatov/database-transactions/tree/main/scenarios),
namespaced by database as `scenarios/postgres/…` and `scenarios/mysql/…`. Each one opens real,
separate database connections (the "sessions" `A`, `B`, `C` in the transcripts), interleaves
their statements in a precise order, and asserts every outcome:

```yaml
- A: SELECT balance FROM accounts WHERE id = 1
  expect: [{ balance: 200 }]
  comment: same query, same transaction, different answer
```

If PostgreSQL or MySQL ever stops behaving the way a lesson describes, the assertion fails
and the build goes red.

Reading the scenarios is easy once you know the four verbs:

| Step | Meaning |
|---|---|
| `A: SQL` | session A runs a statement; the scenario fails if it errors (add `expect:` to assert the rows it returns) |
| `A.fails: SQL` | the statement **must** error, with the exact `error:` code (SQLSTATE on PostgreSQL, errno on MySQL) |
| `blocks: p1` | the statement **must** block on a lock, verified live via the database's lock-wait views |
| `success: p1` / `failure: p1` | the blocked statement must later complete / must later fail |

A handful of scenarios stay TypeScript instead of YAML, like the
[`40001` retry helper](/postgres/05-patterns/retrying-serialization-failures) and the
[LISTEN/NOTIFY listener](/postgres/06-distributed/listen-notify), because there the
client-side code *is* the lesson.

Even "this query blocks now" is a verified claim: the harness polls the server
(`pg_stat_activity` on PostgreSQL, `performance_schema.data_locks` on MySQL) until the
backend actually reports a lock wait, and fails the scenario if the statement completes
instead.

## Every transcript is generated, never hand-written

The CLI-style session logs on every page are produced by `bun run gen`, which replays each
scenario against the real database and renders what actually happened. Transcripts are
committed to the repo, and CI regenerates them on every push:

```sh
bun test                      # every scenario, every assertion
bun run gen                   # regenerate every transcript
git diff --exit-code docs     # any drift from real behavior fails the build
```

A green build therefore means, literally: *every transcript on this site was just reproduced
against the pinned database version* (see the footer under each transcript). Only two things
are normalized for reproducibility: transaction ids (rendered as `1001, 1002, …`) and
backend/connection ids (rendered as `pid(A)`).

## Every claim is checked through two independent drivers

Transcripts show SQL and its results. They don't depend on the client, so the TypeScript
harness is the sole transcript generator, and the transcript is the only code a lesson
page shows: plain SQL, color-coded per session. But a single driver can lie: what looks like
database behavior may be an artifact of how that driver reports it. So the same YAML
scenarios are re-verified through a completely independent pair of drivers: a thin Python
harness ([`python/`](https://github.com/svyatov/database-transactions/tree/main/python),
psycopg + PyMySQL) runs every scenario under pytest against the same databases. A claim only
stands when both agree. Where the drivers genuinely differ (say, after a server-side
connection kill, one reports the server's FATAL error code while the other only notices the
closed socket), the scenario must list both accepted outcomes explicitly.

## The proofs are readable by machines too

If you're an agent, or you're pointing one here, skip the prose:
[`/llms.txt`](/llms.txt) indexes two files written by the same generation pass that writes
the transcripts. [`/llms-full.txt`](/llms-full.txt) is every transcript on this site,
concatenated, each one labelled with the scenario that produced it and the claim it proves.
[`/ledger.jsonl`](/ledger.jsonl) is the structured form: one JSON Lines record per scenario,
carrying the engine and the version it reported, the claim, the sessions, and every error
code the database emitted during the run.

The ledger comes with no schema-stability guarantee. Its shape grows as this site does, and
a consumer that pins to today's keys will eventually break. That is a deliberate trade: the
alternative is a version field, which would imply a compatibility promise this project isn't
ready to make.

## The harness is part of the reading material

The whole machinery is ~800 lines of documented TypeScript in
[`harness/`](https://github.com/svyatov/database-transactions/tree/main/harness). Everything
database-specific lives side by side in
[`harness/dialect.ts`](https://github.com/svyatov/database-transactions/blob/main/harness/dialect.ts),
and the blocked-statement detector is itself a small lesson in lock-wait monitoring.

## Found something wrong?

Then a scenario is missing or an assertion is too weak. That's a bug in this site, and it's
fixable in a uniquely satisfying way:
[open an issue](https://github.com/svyatov/database-transactions/issues) or send a PR with a
failing scenario.
