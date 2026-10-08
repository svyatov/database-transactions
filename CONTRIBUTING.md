# Contributing

Every behavioral claim needs stated scope and support: **Demonstrated behavior**, asserted by an executed Scenario, or a **Documented contract**, supported by an exact linked official-manual quotation. State the engine/version, operation, transaction boundary, configuration, and participating writers when they change the result. One executed schedule does not establish a universal guarantee. Unasserted returned columns and narrator notes do not become additional proofs through generation.

One exception, and it has to be marked. A guarantee that's entailed by stated engine or isolation
semantics but that no scenario here demonstrates may be stated if it carries a `†`, a legend
saying no transcript proves it, and a link to the lesson that explains why it holds — see
[the cross-engine table](docs/concepts/anomalies-by-engine.md). Demonstrated and entailed are
different things, and the reader gets to see which one they're looking at. A claim you merely
believe still doesn't ship.

The accepted policy in [#31](https://github.com/svyatov/database-transactions/issues/31) also requires application-model and external-effect limits. Do not call an explicit database rollback a process crash or a narrated publication an observed receiver effect. Advice and hypothetical symptoms must not imply executed or measured guarantees.

## Setup

```sh
bun install
docker compose up -d --wait   # PostgreSQL on :54321, MySQL on :33061
bun test                      # all scenarios must pass before you start
uv sync --directory python    # optional: the cross-driver check
```

## Adding or changing a lesson

1. **Write the scenario** in `scenarios/<db>/<NN-chapter>/<slug>.yaml` (`<db>` is
   `postgres` or `mysql`): `title`, `claim`, `setup` SQL, `sessions`, and an ordered list
   of `steps`. The format is defined by `harness/loader.ts` (~150 lines — read it) and
   any existing scenario shows the idiom. Assert each claimed Scenario outcome: `expect:` (subset row
   match), `affected:`, `error:` on `<session>.fails:` steps; a statement that must block
   gets `blocks: p1`, resolved later by `- success: p1` or `- failure: p1`. Teaching
   remarks go in `comment:` (rendered as `-- …` in the transcript) and `note:` steps.
   Scenarios whose *client-side code* is the lesson (retry loops, listeners) may instead
   be TypeScript files default-exporting `scenario({...})` — see
   `scenarios/postgres/05-patterns/retry-serialization-failures.ts`.
2. **Keep transcripts deterministic**: database-relevant CI regenerates them and fails on any diff:
   - `ORDER BY` on every multi-row SELECT; no timestamps, durations, or raw pids/oids
     in output (xid and pid *columns* are normalized automatically; an id inside SQL
     text is not — on PostgreSQL filter `pg_stat_activity` by `application_name`; on
     MySQL select id columns like `waiting_pid` and expect `"$pid(A)"`).
   - Nondeterministic waits go in `- sleep: <ms>` steps — invisible to transcripts.
   - Run `bun run gen` twice — the second run must produce no diff.
   There is no porting step: pytest re-runs the same YAML through a second, independent
   pair of drivers (psycopg + PyMySQL) automatically.
3. **Write the lesson page** in `docs/<db>/<NN-chapter>/<slug>.md`: prose plus the
   transcript include — the transcript *is* the code readers see (plain SQL, one color
   per session):

   ```md
   <!--@include: ./parts/<slug>.md-->
   ```

   Quotes from the PostgreSQL or MySQL manual must be verbatim and linked to the exact
   page (and anchor where one exists).
4. **Generate and commit the transcript**: `bun run gen` — commit the changed files
   under `docs/**/parts/` together with your scenario.

### Giving a pattern a second act

A chapter 7 Scenario can examine a failure boundary of a chapter 5 recipe. `queue-bloat.yaml` executes the job queue's own SQL under one idle worker with an assigned transaction ID. Its fixed schedule asserts row counts, heap pages, and occupied slots before and after VACUUM. It measures neither a production throughput rate nor a disk-full incident.

Three moves build one:

1. Author the chapter 7 scenario so it runs the pattern's *own* SQL — copied from the chapter 5
   scenario, not paraphrased — and measures the failure that SQL produces at volume. Copying the
   taught statements is what makes the scenario a proof of *that* pattern rather than a lookalike.
2. Link forward from the pattern lesson, at the sentence where it already warns about this
   failure (job-queue's "the transaction is the lease"). Nothing else in chapter 5 changes.
3. Add a compendium entry that composes the two halves already indexed separately — for
   queue-bloat, entry 7 ("a table keeps growing") and entry 9 ("two workers process the same
   job") — and links the scenario as its proof.

Check existing chapter 3/4 evidence before adding a duplicate. The long-transactions example concerns an old snapshot; queue-bloat concerns its stated assigned-xid removal horizon and queue schedule. Claim only the composition's asserted observations. Neither schedule measures a universal rate, and neither establishes that all VACUUM work stops.

## Before opening a PR

```sh
bunx tsc --noEmit                     # types
bun test                              # Scenario assertions, both databases
bun run gen                           # then `git diff` must be empty — transcripts committed & stable
uv run --directory python pytest      # the second pair of drivers agrees
bun run docs:anchors                  # every internal `#anchor` points at a real heading
bun run docs:references               # registered audit citations match their pinned source excerpts
bun run docs:build                    # site builds, every link's target page exists
```

Serialize these database commands. Python checks shared YAML only; TypeScript client code has no Python parity. CI's path filter can skip database execution for prose-only changes. Semantic claim assessment, assertion execution, driver agreement, artifact stability, and rendered-reader QA must be reported separately.

`docs:build` only checks that a link's *page* exists — it strips the `#fragment` first, so a
stale heading slug sails through. `docs:anchors` is what catches that.

For an audit handoff with source-line citations, add a `docs/audits/*.references.json`
manifest with the document path, full baseline commit SHA, level-two section heading,
and each citation's exact source lines in order. `docs:references` checks every backtick
`path:lines` citation in that section against the manifest and the pinned Git source,
including comma-separated lines and ranges. A line that exists but contains different
text fails. Review whether the excerpt supports the disposition separately; the check
does not decide semantic relevance. Historical commits must be available locally.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(03-locking): …`, `fix(harness): …`).
