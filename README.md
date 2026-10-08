# database-transactions

**Learn database transactions from verified, runnable examples.**

An interactive tutorial covering isolation levels, anomalies, locking, MVCC, and real-world
concurrency patterns, using **asserted real-database schedules, documented contracts, and explicitly marked derivations**.

📖 **Read online:** https://database-transactions.svyatov.com/

## How it works

Learning transactions usually means piecing things together from scattered articles with the
official manual open in another tab. This project puts the whole picture in one place and
states which kind of evidence supports each explanation:

- Every session transcript you see in the docs is **generated from a real run** against
  the database. CI checks generated-artifact drift when database-relevant paths change.
- **Scenarios** orchestrate sessions and assert specified outcomes (`bun test` runs them all). A successful schedule does not prove every possible execution. Reference-only topics use manual support.
- **Documented contracts** use exact official-manual quotations. **Entailed guarantees** carry `†`, a derivation, and an execution limit. Prose-only CI builds can reuse committed Transcripts without a new database run.

## Run it locally

```sh
git clone https://github.com/svyatov/database-transactions.git
cd database-transactions
bun install
docker compose up -d --wait   # PostgreSQL 18.6 on :54321, MySQL 8.4 on :33061
bun test                      # run every Scenario and its assertions
bun lesson                    # list every lesson scenario…
bun lesson mysql/03-locking/deadlock --step   # …and replay one live, statement by statement
bun run gen                   # regenerate all transcripts from real runs
bun run docs:dev              # browse the site locally
```

Requirements: [Bun](https://bun.com) and [Docker](https://www.docker.com/). The SQL clients are built into Bun; the PostgreSQL LISTEN/NOTIFY Scenario uses `docker compose exec` to run psql inside the supplied PostgreSQL container. The optional independent YAML check needs Python 3.12+ and uv. Local Docker defaults need no `.env`; alternative servers need disposable schemas and the privileges/configuration in [run locally](docs/about/run-locally.md). Serialize all reset-capable runners.

## Curriculum

| Chapter | PostgreSQL | MySQL |
|---|---|---|
| 1. Transactions 101: ACID, BEGIN/COMMIT/ROLLBACK, savepoints | ✅ | ✅ |
| 2. Isolation levels & anomalies: dirty reads, non-repeatable reads, phantoms, lost updates, write skew | ✅ | ✅ |
| 3. Locking: row locks, lock queues, NOWAIT/SKIP LOCKED, deadlocks, monitoring | ✅ | ✅ |
| 4. MVCC internals: snapshots, bloat, VACUUM / undo logs, history length | ✅ | ✅ |
| 5. Real-world patterns: optimistic/pessimistic locking, retries, job queues, idempotency | ✅ | ✅ |
| 6. Transactions across services: outbox, sagas, two-phase commit | ✅ | ✅ |
| 7. Pitfalls compendium: symptom → broken pattern → fix | ✅ | ✅ |
| 8. Production: spotting, debugging, and monitoring transaction bugs live | ✅ | ✅ |

Shared YAML Scenarios are checked through a **second, independent pair of drivers**, psycopg and PyMySQL. TypeScript client-code Scenarios have no Python parity. Agreement supports the checked outcomes, not all prose or all driver behavior. Accepted connection-error variants are stated explicitly.

```sh
uv sync --directory python && uv run --directory python pytest   # the same claims, second drivers
```

## Repository layout

- `scenarios/<db>/` — one **YAML file per demo**: named sessions (dedicated database
  connections), an ordered list of SQL steps interleaving them, and the expected outcome
  of each step, including "this query MUST block now", verified via live lock-wait
  monitoring. A handful of scenarios whose *client code* is the lesson (retry loops,
  LISTEN/NOTIFY) stay as TypeScript.
- `harness/` — ~800 lines that make the above work: `loader.ts` interprets the YAML,
  everything database-specific sits side by side in `harness/dialect.ts`. Deliberately
  small and readable; it's part of the learning material.
- `python/` — the cross-driver check: a second thin harness (psycopg + PyMySQL) that
  pytest runs in CI against the *same* YAML scenarios. Transcripts come only from the
  TypeScript harness; this one exists purely to re-verify the claims.
- `docs/<db>/` — the VitePress site, one track per database. Lesson pages show plain SQL:
  the *generated transcripts* (color-coded per session), nothing is duplicated by hand.

## Questions and feedback

Something in the docs unclear, hard to follow, or missing? Have a suggestion, an idea for a
lesson, or just a question? [Open an issue](https://github.com/svyatov/database-transactions/issues).
Questions and "this page didn't click for me" are as welcome as bug reports. If an explanation
lost you somewhere, telling us where is genuinely useful.

## Contributing

Found a wrong or unproven claim? That's a bug. See [CONTRIBUTING.md](CONTRIBUTING.md);
the evidence policy separates asserted schedules, exact manual support, and marked derivations.

## License

MIT © Leonid Svyatov
