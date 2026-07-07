# database-transactions

**Learn database transactions from verified, runnable examples.**

An interactive tutorial covering isolation levels, anomalies, locking, MVCC, and real-world
concurrency patterns — where **every single claim is proven by executable code** running against
a real database.

📖 **Read online:** https://svyatov.github.io/database-transactions/

## Why trust this tutorial?

Most database articles contain statements that are subtly wrong, outdated, or true only for
some other database. This project takes a different approach:

- Every session transcript you see in the docs is **generated from a real run** against
  the database — never hand-written, so it can never drift from actual behavior.
- Every lesson ships with a **scenario**: an executable definition that orchestrates
  concurrent sessions and **asserts** the outcome (`bun test` runs them all).
- CI regenerates every transcript on every push and fails if anything changed.
  A green build literally means "every statement on the site was just re-verified".

## Run it locally

```sh
git clone https://github.com/svyatov/database-transactions.git
cd database-transactions
bun install
docker compose up -d --wait   # PostgreSQL 18.4 on :54321, MySQL 8.4 on :33061
bun test                      # run every scenario, assert every claim
bun lesson                    # list every lesson scenario…
bun lesson mysql/deadlock --step   # …and replay one live, statement by statement
bun run gen                   # regenerate all transcripts from real runs
bun run docs:dev              # browse the site locally
```

Requirements: [Bun](https://bun.com) and [Docker](https://www.docker.com/). That's it —
the database client is built into Bun.

## Curriculum

| Chapter | PostgreSQL | MySQL |
|---|---|---|
| 1. Transactions 101 — ACID, BEGIN/COMMIT/ROLLBACK, savepoints | ✅ | ✅ |
| 2. Isolation levels & anomalies — dirty reads, non-repeatable reads, phantoms, lost updates, write skew | ✅ | ✅ |
| 3. Locking — row locks, lock queues, NOWAIT/SKIP LOCKED, deadlocks, monitoring | ✅ | ✅ |
| 4. MVCC internals — snapshots, bloat, VACUUM / undo logs, history length | ✅ | 🚧 |
| 5. Real-world patterns — optimistic/pessimistic locking, retries, job queues, idempotency | ✅ | 🚧 |
| 6. Transactions across services — outbox, sagas, two-phase commit | ✅ | 🚧 |
| 7. Pitfalls compendium — symptom → broken pattern → fix | ✅ | 🚧 |
| 8. Production — spotting, debugging, and monitoring transaction bugs live | ✅ | 🚧 |

Every scenario is also re-verified from **Python** (psycopg + PyMySQL) in CI — same YAML,
different driver. More languages (Ruby, PHP) are on the roadmap: each one is a ~100-line
loader, not a re-write of the scenarios.

```sh
uv sync --directory python && uv run --directory python pytest   # the same claims, from Python
```

## How it works

- `scenarios/<db>/` — one **YAML file per demo**: named sessions (dedicated database
  connections), an ordered list of SQL steps interleaving them, and the expected outcome
  of each step — including "this query MUST block now", verified via live lock-wait
  monitoring. A handful of scenarios whose *client code* is the lesson (retry loops,
  LISTEN/NOTIFY) stay as TypeScript.
- `harness/` — ~600 lines that make the above work: `loader.ts` interprets the YAML,
  everything database-specific sits side by side in `harness/dialect.ts`. Deliberately
  small and readable; it's part of the learning material.
- `python/` — a thin Python harness with its own ~100-line loader, run by pytest in CI
  against the *same* YAML scenarios. Transcripts come only from the TypeScript harness —
  other languages re-verify the claims.
- `docs/<db>/` — the VitePress site, one track per database. Lesson pages show plain SQL:
  the *generated transcripts* (color-coded per session) — nothing is duplicated by hand.

## Contributing

Found a wrong or unproven claim? That's a bug. See [CONTRIBUTING.md](CONTRIBUTING.md) —
the golden rule is *no claim without a proving scenario*.

## License

MIT © Leonid Svyatov
