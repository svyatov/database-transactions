# Contributing

The rule that makes this site worth trusting: **no claim without a proving scenario.**
Prose may only state what a scenario asserts or what an official-docs quote (verbatim,
linked) says. If you can't prove it, don't write it.

One exception, and it has to be marked. A guarantee that's entailed by an isolation level's
semantics but that no scenario here demonstrates may be stated if it carries a `†`, a legend
saying no transcript proves it, and a link to the lesson that explains why it holds — see
[the cross-engine table](docs/concepts/anomalies-by-engine.md). Demonstrated and entailed are
different things, and the reader gets to see which one they're looking at. A claim you merely
believe still doesn't ship.

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

### Giving a pattern a second act

A chapter 5 lesson teaches a pattern as a working recipe. Its *second act* is a chapter 7
scenario that prices what the recipe costs at scale when something goes wrong — the incident a
team actually gets paged for. `queue-bloat.yaml` is the first: the job queue's claim/complete
loop, run under a worker that hangs mid-transaction, turns throughput into unreclaimable disk.

Three moves build one:

1. Author the chapter 7 scenario so it runs the pattern's *own* SQL — copied from the chapter 5
   scenario, not paraphrased — and measures the failure that SQL produces at volume. Copying the
   taught statements is what makes the scenario a proof of *that* pattern rather than a lookalike.
2. Link forward from the pattern lesson, at the sentence where it already warns about this
   failure (job-queue's "the transaction is the lease"). Nothing else in chapter 5 changes.
3. Add a compendium entry that composes the two halves already indexed separately — for
   queue-bloat, entry 7 ("a table keeps growing") and entry 9 ("two workers process the same
   job") — and links the scenario as its proof.

The trap, learned the hard way building this one: the failure mode is usually already proven
somewhere in chapters 3–4, and a scenario that restates it is a duplicate, not a second act.
VACUUM freezing behind an old snapshot was already `long-transactions`. A second act has to claim
only what the *composition* adds. Here that was a rate: the bloat grows with the queue's
throughput, a number no single-mechanism lesson shows.

## Before opening a PR

```sh
bunx tsc --noEmit                     # types
bun test                              # every claim re-verified, both databases
bun run gen                           # then `git diff` must be empty — transcripts committed & stable
uv run --directory python pytest      # the second pair of drivers agrees
bun run docs:anchors                  # every internal `#anchor` points at a real heading
bun run docs:build                    # site builds, every link's target page exists
```

`docs:build` only checks that a link's *page* exists — it strips the `#fragment` first, so a
stale heading slug sails through. `docs:anchors` is what catches that.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(03-locking): …`, `fix(harness): …`).
