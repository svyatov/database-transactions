# How this site works

A hands-on guide to database transactions (isolation levels, anomalies, locking, MVCC, and
the concurrency patterns that survive production) for PostgreSQL and MySQL, side by side.
The demonstrations use Transcripts of real sessions. Reference-only topics use official-manual support. One asserted schedule establishes its checked outcomes under the stated conditions, not every possible execution.

It was built because learning this topic usually means piecing it together yourself: an
article here, a conference talk there, the official manual open in a third tab to check which
parts apply to *your* database and version. This site is an attempt to put the whole picture
in one place with three distinct kinds of support:

- **Demonstrated behavior**: a Scenario executes and asserts a result. Fields omitted from a subset `expect:` assertion are observations, not separately checked guarantees.
- **Documented contract**: an exact linked official-manual quotation supports the behavior under its engine/version, operation, and configuration conditions.
- **Entailed guarantee**: `†` marks an inference with a derivation and an explicit statement that no Transcript demonstrates the guarantee. See [the engine comparison](/concepts/anomalies-by-engine).

Advice, illustrative timelines, and hypothetical symptoms are explanations. A database-local Receiver model does not establish real broker, email, payment, process-crash, or network behavior. Generation does not turn narrator notes into assertions.

## Executable demonstrations and reference material {#every-lesson-is-an-executable-scenario}

Each demo you see is a YAML file in
[`scenarios/`](https://github.com/svyatov/database-transactions/tree/main/scenarios),
namespaced by database as `scenarios/postgres/…` and `scenarios/mysql/…`. Each one opens real,
separate database connections (the "sessions" `A`, `B`, `C` in the transcripts), interleaves
their statements in a precise order, and checks specified assertions:

```yaml
- A: SELECT balance FROM accounts WHERE id = 1
  expect: [{ balance: 200 }]
  comment: same query, same transaction, different answer
```

This syntax example shows a row assertion; its complete setup and preceding schedule determine whether 200 is expected. A failed assertion rejects that execution, but does not check unasserted prose. Each Scenario runs on its named engine, not both engines.

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
committed to the repo. Database-relevant CI regenerates them:

```sh
bun test                      # every scenario, every assertion
bun run gen                   # regenerate every transcript
git diff --exit-code docs     # any drift from real behavior fails the build
```

CI runs real-database steps for database-relevant changes, as selected by [the workflow](https://github.com/svyatov/database-transactions/blob/main/.github/workflows/ci.yml). Prose-only changes can build from committed evidence without new database execution. A successful database gate checks assertions and artifact stability on pinned versions, not all prose, exhaustive schedules, production performance, or crash durability. The homepage deadlock snippet is a labelled illustration, not a generated Transcript. Two kinds of identifiers
are normalized for reproducibility: transaction ids (rendered as `1001, 1002, …`) and
backend/connection ids (rendered as `pid(A)`).

## Independent checks for shared YAML {#every-claim-is-checked-through-two-independent-drivers}

Transcripts show SQL and its results. They don't depend on the client, so the TypeScript
harness is the sole transcript generator. SQL Transcripts are color-coded per session; client-code lessons can also display TypeScript. But a single driver can misreport a result: what looks like
database behavior may be an artifact of how that driver reports it. So the same YAML
scenarios are re-verified through a completely independent pair of drivers: a thin Python
harness ([`python/`](https://github.com/svyatov/database-transactions/tree/main/python),
psycopg + PyMySQL) runs shared YAML under pytest against the same databases. TypeScript client-code Scenarios have Bun execution but no Python parity. Agreement supports the checked outcomes; it does not eliminate every possible harness or interpretation error. Where the drivers genuinely differ (say, after a server-side
connection kill, one reports the server's FATAL error code while the other only notices the
closed socket), the scenario must list both accepted outcomes explicitly.

## The proofs are readable by machines too

If you're an agent, or you're pointing one here, skip the prose:
[`/llms.txt`](/llms.txt) indexes two files written by the same generation pass that writes
the transcripts. [`/llms-full.txt`](/llms-full.txt) is every transcript on this site,
concatenated, each one labelled with the scenario that produced it and the claim it proves.
[`/ledger.jsonl`](/ledger.jsonl) is the structured form: one JSON Lines record per scenario,
carrying the engine and the version it reported, the declared claim, the sessions, and recorded error codes. These are source mirrors, not independent assertions. Narration and timeline labels remain Scenario-authored explanations.

The footer's Python clause records an independent YAML check when pytest left its local success marker. Generation removes it. For complete parity evidence, run the full suite after generation; a selected pytest run is not full-suite evidence. Footer commit links identify the build checkout, not a promise that every artifact was executed at that commit. Serialize all reset-capable runners.

The ledger comes with no schema-stability guarantee. Its shape grows as this site does, and
a consumer that pins to today's keys will eventually break. That is a deliberate trade: the
alternative is a version field, which would imply a compatibility promise this project isn't
ready to make.

## The harness is part of the reading material

The execution and rendering code is documented TypeScript in
[`harness/`](https://github.com/svyatov/database-transactions/tree/main/harness). Everything
database-specific lives side by side in
[`harness/dialect.ts`](https://github.com/svyatov/database-transactions/blob/main/harness/dialect.ts),
and the blocked-statement detector is itself a small lesson in lock-wait monitoring.

## Found something wrong?

An overbroad explanation, wrong manual citation, missing assertion, or incorrect generated correspondence can be a defect even when tests pass:
[open an issue](https://github.com/svyatov/database-transactions/issues) or send a PR with a
failing scenario.
