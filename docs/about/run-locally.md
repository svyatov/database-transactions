# Run it locally

Everything on this site runs on your machine with two tools: [Bun](https://bun.com) and
[Docker](https://www.docker.com/). The database clients are built into Bun — there is nothing
else to install.

```sh
git clone https://github.com/svyatov/database-transactions.git
cd database-transactions
bun install
docker compose up -d --wait   # PostgreSQL on :54321, MySQL on :33061 — off-default ports, no clash with local installs
```

## Verify every claim

```sh
bun test
```

This runs every scenario in `scenarios/` — both the `postgres/` and `mysql/` trees — against
the real databases and asserts every outcome — the same check CI runs before anything is
published.

## Replay a lesson in your terminal

```sh
bun lesson                          # list every scenario, grouped by database and chapter
bun lesson postgres/deadlock        # replay one, streaming the transcript live
bun lesson mysql/deadlock --step    # you press Enter before each statement fires
```

`--step` is the closest thing to driving the two psql windows yourself: you decide when each
session's next statement runs, and watch who blocks whom in real time.

## Tinker

The best way to learn is to break things. Open any scenario, change something, and watch:

```sh
# e.g. edit scenarios/postgres/02-isolation/non-repeatable-read.ts:
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
scenario — or found a behavior change in the database itself.
