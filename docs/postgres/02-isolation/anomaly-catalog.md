# The anomaly catalog

Every anomaly from this chapter, every isolation level, and — in the spirit of this site —
a link to the scenario that *proves* each cell. READ UNCOMMITTED is omitted: in PostgreSQL it
[behaves exactly like READ COMMITTED](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them).

| Anomaly | READ COMMITTED *(default)* | REPEATABLE READ | SERIALIZABLE |
|---|---|---|---|
| **Dirty read** | ✅ impossible — [proof](/postgres/02-isolation/read-committed#no-dirty-reads-even-if-you-ask-for-them) | ✅ impossible | ✅ impossible |
| **Non-repeatable read** | ⚠️ [happens](/postgres/02-isolation/read-committed#non-repeatable-reads) | ✅ prevented — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) | ✅ prevented |
| **Phantom read** | ⚠️ [happens](/postgres/02-isolation/read-committed#phantoms) | ✅ prevented in PostgreSQL — [proof](/postgres/02-isolation/repeatable-read#one-snapshot-no-phantoms) *(standard would allow it)* | ✅ prevented |
| **Lost update** | ⚠️ [silent](/postgres/02-isolation/lost-update#watch-a-deposit-disappear) | ✅ rejected with 40001 — [proof](/postgres/02-isolation/lost-update#repeatable-read-turns-it-into-an-error) | ✅ rejected with 40001 |
| **Write skew** | ⚠️ possible¹ | ⚠️ [happens](/postgres/02-isolation/serializable#why-repeatable-read-isn-t-enough-write-skew) | ✅ rejected with 40001 — [proof](/postgres/02-isolation/serializable#the-same-interleaving-serializable) |
| **Read-only anomaly** | —¹ | ⚠️ [happens](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) | ✅ rejected with 40001 — [proof](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions) |

¹ These two anomalies are defined against stable snapshots. READ COMMITTED doesn't provide
snapshot stability in the first place — it's exposed to everything REPEATABLE READ is, plus
the rows themselves can shift mid-transaction (the RR scenarios are the demonstrations of the
strictly-stronger level).

## How to use this table

- Staying on the default? Then **know that lost updates are on you**: fix read-modify-write
  code with atomic updates, `FOR UPDATE`, or version columns
  ([fixing lost updates](/postgres/05-patterns/fixing-lost-updates)).
- Invariants that span multiple rows ("at least one on call", "sum must stay positive",
  "unique-ish under concurrency") are only automatic at **SERIALIZABLE** — anything less needs
  explicit locking.
- Anything running at REPEATABLE READ or SERIALIZABLE **must retry on
  [SQLSTATE 40001](https://www.postgresql.org/docs/current/errcodes-appendix.html)**
  (`serialization_failure`). If you see that error in your logs being swallowed, you've found
  a bug.

## What the standard's table doesn't tell you

The SQL standard's three-anomaly table (dirty / non-repeatable / phantom) dates from 1992.
Lost updates, write skew, and the read-only anomaly were formalized later² — and they're the
ones that actually bite in modern applications, because they emerge from *application logic*
(read, decide, write) rather than from raw statement visibility.

² Berenson et al., [*A Critique of ANSI SQL Isolation Levels*](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/) (1995);
Fekete et al., [*Making Snapshot Isolation Serializable*](https://doi.org/10.1145/1071610.1071615)
(ACM TODS, 2005).
