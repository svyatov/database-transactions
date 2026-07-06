# Contributing

The rule that makes this site worth trusting: **no claim without a proving scenario.**
Prose may only state what a scenario asserts or what an official-docs quote (verbatim,
linked) says. If you can't prove it, don't write it.

## Setup

```sh
bun install
docker compose up -d --wait   # PostgreSQL on :54321, MySQL on :33061
bun test                      # all scenarios must pass before you start
uv sync --directory python    # optional: the Python ports
```

## Adding or changing a lesson

1. **Write the scenario** in `scenarios/<db>/<NN-chapter>/<slug>.ts` (`<db>` is `postgres`
   or `mysql`) — default-export `scenario({...})` (see `harness/scenario.ts`, it's ~80
   lines; everything database-specific lives in `harness/dialect.ts`). Assert every
   outcome with `eq()`; a statement that must block goes through `.blocked`, one that
   must fail through `.fails`. Mark the parts the lesson shows with `// #region name` /
   `// #endregion`.
2. **Keep transcripts deterministic** — CI regenerates them and fails on any diff:
   - `ORDER BY` on every multi-row SELECT; no timestamps, durations, or raw pids/oids
     in output (xid and pid *columns* are normalized automatically; an id inside SQL
     text is not — on PostgreSQL filter `pg_stat_activity` by `application_name`; on
     MySQL select id columns like `waiting_pid` and assert with `t.pid("A")`).
   - Nondeterministic waits go in plain code (`Bun.sleep`) — invisible to transcripts.
   - Run `bun run gen` twice — the second run must produce no diff.
3. **Port it to Python** if the chapter already has Python coverage (chapters 1–3):
   mirror the file at `python/scenarios/<db>/<NN-chapter>/<slug>.py` with the same
   `# region name` markers and the same assertions (see any existing port for the
   pattern; `uv run --directory python pytest` must pass).
4. **Write the lesson page** in `docs/<db>/<NN-chapter>/<slug>.md`: include scenario
   regions with a code-group of all language ports and the transcript with
   `<!--@include: ./parts/<slug>.md-->`:

   ```md
   ::: code-group
   <<< ../../../scenarios/<db>/<NN-chapter>/<slug>.ts#demo{ts} [TypeScript]
   <<< ../../../python/scenarios/<db>/<NN-chapter>/<slug>.py#demo{py} [Python]
   :::
   ```

   Quotes from the PostgreSQL or MySQL manual must be verbatim and linked to the exact
   page (and anchor where one exists).
5. **Generate and commit the transcript**: `bun run gen` — commit the changed files
   under `docs/**/parts/` together with your scenario.

## Before opening a PR

```sh
bunx tsc --noEmit                     # types
bun test                              # every claim re-verified, both databases
bun run gen                           # then `git diff` must be empty — transcripts committed & stable
uv run --directory python pytest      # the Python ports agree
bun run docs:build                    # site builds, all internal links resolve
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(03-locking): …`, `fix(harness): …`).
