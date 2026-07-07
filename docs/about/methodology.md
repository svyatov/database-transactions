# Why trust this site?

Most articles about database transactions contain statements that are subtly wrong, outdated,
or true only for some *other* database. This site takes a different approach: **nothing here is
claimed — everything is demonstrated.**

## Every lesson is an executable scenario

Each demo you see is a YAML file in
[`scenarios/`](https://github.com/svyatov/database-transactions/tree/main/scenarios) —
namespaced by database, `scenarios/postgres/…` and `scenarios/mysql/…` — that opens real,
separate database connections (the "sessions" `A`, `B`, `C` in the transcripts), interleaves
their statements in a precise order, and **asserts** every outcome:

```yaml
- A: SELECT balance FROM accounts WHERE id = 1
  expect: [{ balance: 200 }]
  comment: same query, same transaction — different answer
```

If PostgreSQL ever stops behaving the way a lesson describes, the assertion fails and the
build goes red.

Reading the scenarios is easy once you know the four verbs:

| Step | Meaning |
|---|---|
| `A: SQL` | session A runs a statement; the scenario fails if it errors (add `expect:` to assert the rows it returns) |
| `A.fails: SQL` | the statement **must** error, with the exact `error:` code (SQLSTATE on PostgreSQL, errno on MySQL) |
| `blocks: p1` | the statement **must** block on a lock — verified live via the database's lock-wait views |
| `success: p1` / `failure: p1` | the blocked statement must later complete / must later fail |

A handful of scenarios stay TypeScript instead of YAML — the
[`40001` retry helper](/postgres/05-patterns/retrying-serialization-failures) and the
[LISTEN/NOTIFY listener](/postgres/06-distributed/listen-notify) — because there the
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
are normalized for reproducibility — transaction ids (rendered as `1001, 1002, …`) and
backend/connection ids (rendered as `pid(A)`).

## Every claim is checked through two independent drivers

Transcripts show SQL and its results — they don't depend on the client, so the TypeScript
harness is the **sole transcript generator**, and the transcript is the only code a lesson
page shows: plain SQL, color-coded per session. But a single driver can lie: what looks like
database behavior may be an artifact of how that driver reports it. So the same YAML
scenarios are re-verified through a completely independent pair of drivers — a thin Python
harness ([`python/`](https://github.com/svyatov/database-transactions/tree/main/python),
psycopg + PyMySQL) runs every scenario under pytest against the same databases. A claim only
stands when both agree; where the drivers genuinely differ — e.g. after a server-side
connection kill, one reports the server's FATAL error code while the other only notices the
closed socket — the scenario must list both accepted outcomes explicitly.

## The harness is part of the reading material

The whole machinery is ~800 lines of documented TypeScript in
[`harness/`](https://github.com/svyatov/database-transactions/tree/main/harness) — everything
database-specific lives side by side in
[`harness/dialect.ts`](https://github.com/svyatov/database-transactions/blob/main/harness/dialect.ts),
and the blocked-statement detector is itself a small lesson in lock-wait monitoring.

## Found something wrong?

Then a scenario is missing or an assertion is too weak — that's a bug in this site, and it's
fixable in a uniquely satisfying way:
[open an issue](https://github.com/svyatov/database-transactions/issues) or send a PR with a
failing scenario.
