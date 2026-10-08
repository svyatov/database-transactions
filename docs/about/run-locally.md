# Run it locally

The standard SQL Scenarios use [Bun](https://bun.com) and [Docker](https://www.docker.com/). The PostgreSQL LISTEN/NOTIFY code Scenario runs psql through `docker compose exec` inside the supplied PostgreSQL container; no host psql installation is required. The optional independent YAML check uses Python 3.12 or later and [uv](https://docs.astral.sh/uv/). Reference-only contracts are explained in [the methodology](/about/methodology), not executed locally.

```sh
git clone https://github.com/svyatov/database-transactions.git
cd database-transactions
bun install
docker compose up -d --wait   # PostgreSQL on :54321, MySQL on :33061 — off-default ports, no clash with local installs
```

## Check Scenario assertions {#verify-every-claim}

Manual contracts, marked derivations, and editorial correctness require their separate evidence checks.

```sh
bun test
```

This runs every scenario in `scenarios/` (both the `postgres/` and `mysql/` trees) against
the real databases and checks their explicit assertions. CI runs the database suite for database-relevant changes; prose-only builds can reuse committed evidence.

A second, independent pair of drivers (psycopg + PyMySQL, the Python harness) re-verifies
shared YAML Scenarios only, run with uv. TypeScript client-code Scenarios have no Python parity:

```sh
uv sync --directory python
uv run --directory python pytest
```

Run Bun, generation, CLI replays, and Python checks one at a time: they reset shared schemas. The local Docker defaults are built into both harnesses, so no `.env` file is required. An alternative installation uses `DATABASE_URL` for PostgreSQL and `MYSQL_URL` for MySQL, an isolated disposable database, sufficient schema/reset and monitoring privileges, PostgreSQL prepared transactions and `pageinspect`, and the MySQL settings used by its Scenarios. The notification helper still targets the Compose PostgreSQL service rather than an alternate URL, so the full suite expects the supplied local containers. Never point the reset-capable runners at application data.

## Replay a lesson in your terminal

```sh
bun lesson                          # list every scenario, grouped by database and chapter
bun lesson postgres/03-locking/deadlock # replay one, streaming the transcript live
bun lesson mysql/03-locking/deadlock --step # you press Enter before each statement fires
```

`--step` is the closest thing to driving the two psql windows yourself: you decide when each
session's next statement runs, and watch who blocks whom in real time.

## Tinker

The best way to learn is to break things. Open any scenario, change something, and watch:

```sh
# e.g. edit scenarios/postgres/02-isolation/non-repeatable-read.yaml:
#   change  BEGIN ISOLATION LEVEL READ COMMITTED
#   to      BEGIN ISOLATION LEVEL REPEATABLE READ
bun test
```

The `expect: [{ balance: 200 }]` assertion now fails. At REPEATABLE READ the second read
returns `100` in this schedule, excluding B's later commit from A's snapshot. Own writes remain visible. Inspect the Scenario's transaction and operation scope before generalizing the result.

## Regenerate the transcripts

```sh
bun run gen        # re-runs all scenarios, rewrites docs/**/parts/*.md
bun run docs:dev   # browse the site locally
```

If your regenerated transcripts differ from the committed ones, you've either changed a
scenario, environment/version, driver, harness, or renderer. Inspect the exact difference before attributing it to database behavior. Run `bun run gen` a second time and require no new drift.
