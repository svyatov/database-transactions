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
- Every lesson ships with a **scenario**: an executable script that orchestrates concurrent
  sessions and **asserts** the outcome (`bun test` runs them all).
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

Chapters 1–3 are also available in **Python** — every lesson shows TypeScript and Python
side by side, and both are executed in CI. More languages (Ruby, PHP) are on the roadmap —
the structure below is built for them.

```sh
uv sync --directory python && uv run --directory python pytest   # the same claims, from Python
```

## How it works

- `scenarios/<db>/` — one TypeScript file per demo. Each opens named sessions (dedicated
  database connections), interleaves their statements with plain `await` order, and asserts
  outcomes — including "this query MUST block now" via live lock-wait monitoring.
- `harness/` — ~500 lines that make the above work, with everything database-specific
  side by side in `harness/dialect.ts`. Deliberately small and readable; it's part of the
  learning material.
- `python/` — the same scenarios and a thin harness in Python (psycopg + PyMySQL), run by
  pytest in CI. Transcripts come only from the TypeScript harness — other languages
  re-verify the claims.
- `docs/<db>/` — the VitePress site, one track per database. Lesson pages include the
  *actual scenario source* (VitePress snippet imports, with a language tab per port) and
  the *generated transcripts* — nothing is duplicated by hand.

## Contributing

Found a wrong or unproven claim? That's a bug. See [CONTRIBUTING.md](CONTRIBUTING.md) —
the golden rule is *no claim without a proving scenario*.

## License

MIT © Leonid Svyatov
