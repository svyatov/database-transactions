# Contributing

The rule that makes this site worth trusting: **no claim without a proving scenario.**
Prose may only state what a scenario asserts or what an official-docs quote (verbatim,
linked) says. If you can't prove it, don't write it.

## Setup

```sh
bun install
docker compose up -d --wait   # PostgreSQL on localhost:54321
bun test                      # all scenarios must pass before you start
```

## Adding or changing a lesson

1. **Write the scenario** in `scenarios/postgres/<NN-chapter>/<slug>.ts` — default-export
   `scenario({...})` (see `harness/scenario.ts`, it's ~70 lines). Assert every outcome
   with `eq()`; a statement that must block goes through `.blocked`, one that must fail
   through `.fails`. Mark the parts the lesson shows with `// #region name` /
   `// #endregion`.
2. **Keep transcripts deterministic** — CI regenerates them and fails on any diff:
   - `ORDER BY` on every multi-row SELECT; no timestamps, durations, or raw pids/oids
     in output (xids and pid *columns* are normalized automatically; a pid inside SQL
     text is not — filter `pg_stat_activity` by `application_name` instead, session
     names are set for you).
   - Nondeterministic waits go in plain code (`Bun.sleep`) — invisible to transcripts.
3. **Write the lesson page** in `docs/postgres/<NN-chapter>/<slug>.md`: include scenario regions
   with `<<< ../../../scenarios/postgres/…#region{ts}` and the transcript with
   `<!--@include: ./parts/<slug>.md-->`. Quotes from the PostgreSQL manual must be
   verbatim and linked to the exact page (and anchor where one exists).
4. **Generate and commit the transcript**: `bun run gen` — commit the changed files
   under `docs/**/parts/` together with your scenario.

## Before opening a PR

```sh
bunx tsc --noEmit     # types
bun test              # every claim re-verified
bun run gen           # then `git diff` must be empty — transcripts committed & stable
bun run docs:build    # site builds, all internal links resolve
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(03-locking): …`, `fix(harness): …`).
