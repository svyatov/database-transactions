# Run it locally

Everything on this site runs on your machine with two tools: [Bun](https://bun.com) and
[Docker](https://www.docker.com/). The PostgreSQL client is built into Bun — there is nothing
else to install.

```sh
git clone https://github.com/svyatov/postgres-transactions.git
cd postgres-transactions
bun install
docker compose up -d --wait   # PostgreSQL on localhost:54321 (not 5432 — no clash with a local install)
```

## Verify every claim

```sh
bun test
```

This runs every scenario in `scenarios/` against the database and asserts every outcome —
the same check CI runs before anything is published.

## Tinker

The best way to learn is to break things. Open any scenario, change something, and watch:

```sh
# e.g. edit scenarios/02-isolation/non-repeatable-read.ts:
#   change  BEGIN ISOLATION LEVEL READ COMMITTED
#   to      BEGIN ISOLATION LEVEL REPEATABLE READ
bun test
```

The assertion `eq(second!.balance, 200)` now fails — at REPEATABLE READ the second read
returns `100`, because the anomaly you just read about *can no longer happen*. Every failing
scenario prints its transcript up to the failure, so you can see exactly where reality
diverged from the script.

## Regenerate the transcripts

```sh
bun run gen        # re-runs all scenarios, rewrites docs/**/parts/*.md
bun run docs:dev   # browse the site locally
```

If your regenerated transcripts differ from the committed ones, you've either changed a
scenario — or found a behavior change in PostgreSQL itself.
