# Contributing

The rule that makes this site worth trusting: **no claim without a proving scenario.**
Prose may only state what a scenario asserts or what an official-docs quote (verbatim,
linked) says. If you can't prove it, don't write it.

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
   of `steps`. The format is defined by `harness/loader.ts` (~130 lines — read it) and
   any existing scenario shows the idiom. Every claim is asserted: `expect:` (subset row
   match), `affected:`, `error:` on `<session>.fails:` steps; a statement that must block
   gets `blocks: p1`, resolved later by `- success: p1` or `- failure: p1`. Teaching
   remarks go in `comment:` (rendered as `-- …` in the transcript) and `note:` steps.
   Scenarios whose *client-side code* is the lesson (retry loops, listeners) may instead
   be TypeScript files default-exporting `scenario({...})` — see
   `scenarios/postgres/05-patterns/retry-serialization-failures.ts`.
2. **Keep transcripts deterministic** — CI regenerates them and fails on any diff:
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

## Before opening a PR

```sh
bunx tsc --noEmit                     # types
bun test                              # every claim re-verified, both databases
bun run gen                           # then `git diff` must be empty — transcripts committed & stable
uv run --directory python pytest      # the second pair of drivers agrees
bun run docs:build                    # site builds, all internal links resolve
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(03-locking): …`, `fix(harness): …`).
