# Why trust this site?

Most articles about database transactions contain statements that are subtly wrong, outdated,
or true only for some *other* database. This site takes a different approach: **nothing here is
claimed — everything is demonstrated.**

## Every lesson is an executable scenario

Each demo you see is a TypeScript file in
[`scenarios/`](https://github.com/svyatov/postgres-transactions/tree/main/scenarios) that opens
real, separate PostgreSQL connections (the "sessions" `A`, `B`, `C` in the transcripts),
interleaves their statements in a precise order, and **asserts** every outcome:

```ts
const [second] = await A`SELECT balance FROM accounts WHERE id = 1`;
eq(second!.balance, 200); // same query, same transaction — different answer
```

If PostgreSQL ever stops behaving the way a lesson describes, the assertion fails and the
build goes red.

Reading the scenarios is easy once you know the four verbs:

| Code | Meaning |
|---|---|
| ``await A`SQL` `` | session A runs a statement; the scenario fails if it errors |
| ``await A.fails`SQL` `` | the statement **must** error; returns the error so its SQLSTATE can be asserted |
| ``await B.blocked`SQL` `` | the statement **must** block on a lock — verified live via `pg_stat_activity` |
| `await pending.success()` / `.failure()` | the blocked statement must later complete / must later fail |

Even "this query blocks now" is a verified claim: the harness polls `pg_stat_activity` until
the backend actually reports a lock wait, and fails the scenario if the statement completes
instead.

## Every transcript is generated, never hand-written

The psql-style session logs on every page are produced by `bun run gen`, which replays each
scenario against PostgreSQL and renders what actually happened. Transcripts are committed to
the repo, and CI regenerates them on every push:

```sh
bun test                      # every scenario, every assertion
bun run gen                   # regenerate every transcript
git diff --exit-code docs     # any drift from real behavior fails the build
```

A green build therefore means, literally: *every transcript on this site was just reproduced
against the pinned PostgreSQL version* (see the footer under each transcript). Only two things
are normalized for reproducibility — transaction ids (rendered as `1001, 1002, …`) and backend
pids (rendered as `pid(A)`).

## The harness is part of the reading material

The whole machinery is ~400 lines of documented TypeScript in
[`harness/`](https://github.com/svyatov/postgres-transactions/tree/main/harness) — the
blocked-statement detector is itself a small lesson in `pg_stat_activity` monitoring.

## Found something wrong?

Then a scenario is missing or an assertion is too weak — that's a bug in this site, and it's
fixable in a uniquely satisfying way:
[open an issue](https://github.com/svyatov/postgres-transactions/issues) or send a PR with a
failing scenario.
