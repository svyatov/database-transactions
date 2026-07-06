# postgres-transactions

**Learn PostgreSQL transactions from verified, runnable examples.**

An interactive tutorial covering isolation levels, anomalies, locking, MVCC, and real-world
concurrency patterns — where **every single claim is proven by executable code** running against
a real PostgreSQL 18.4 instance.

📖 **Read online:** https://svyatov.github.io/postgres-transactions/

## Why trust this tutorial?

Most database articles contain statements that are subtly wrong, outdated, or true only for
some other database. This project takes a different approach:

- Every session transcript you see in the docs is **generated from a real run** against
  PostgreSQL — never hand-written, so it can never drift from actual behavior.
- Every lesson ships with a **scenario**: an executable script that orchestrates concurrent
  sessions and **asserts** the outcome (`bun test` runs them all).
- CI regenerates every transcript on every push and fails if anything changed.
  A green build literally means "every statement on the site was just re-verified".

## Run it locally

```sh
git clone https://github.com/svyatov/postgres-transactions.git
cd postgres-transactions
bun install
docker compose up -d --wait   # PostgreSQL 18.4 on localhost:54321
bun test                      # run every scenario, assert every claim
bun run gen                   # regenerate all transcripts from real runs
bun run docs:dev              # browse the site locally
```

Requirements: [Bun](https://bun.com) and [Docker](https://www.docker.com/). That's it —
the Postgres client is built into Bun.

## Curriculum

| Chapter | Status |
|---|---|
| 1. Transactions 101 — ACID, BEGIN/COMMIT/ROLLBACK, savepoints | ✅ |
| 2. Isolation levels & anomalies — dirty reads, non-repeatable reads, phantoms, lost updates, write skew | ✅ |
| 3. Locking — row locks, lock queues, NOWAIT/SKIP LOCKED, deadlocks, monitoring | 🚧 planned |
| 4. MVCC internals — xmin/xmax, snapshots, bloat, VACUUM, long transactions | 🚧 planned |
| 5. Real-world patterns — optimistic/pessimistic locking, retries, job queues, idempotency | 🚧 planned |
| 6. Transactions across services — outbox, LISTEN/NOTIFY, sagas, two-phase commit | 🚧 planned |
| 7. Pitfalls compendium — symptom → broken pattern → fix | 🚧 planned |
| 8. Production — spotting, debugging, and monitoring transaction bugs live | 🚧 planned |

## How it works

- `scenarios/` — one TypeScript file per demo. Each opens named sessions (dedicated
  PostgreSQL connections), interleaves their statements with plain `await` order, and asserts
  outcomes — including "this query MUST block now" via `pg_stat_activity` monitoring.
- `harness/` — ~400 lines that make the above work. Deliberately small and readable;
  it's part of the learning material.
- `docs/` — the VitePress site. Lesson pages include the *actual scenario source* (VitePress
  snippet imports) and the *generated transcripts* — nothing is duplicated by hand.

## License

MIT © Leonid Svyatov
