# Snapshots & the four levels

InnoDB is an MVCC engine: readers look at a **consistent snapshot** instead of locking rows,
so plain SELECTs never block writers and writers never block plain SELECTs. Which snapshot a
statement sees — and when reads take locks anyway — is decided by the **isolation level**.

MySQL implements all four SQL-standard levels, and unlike PostgreSQL, all four are *actually
different*:

| Level | Dirty read | Non-repeatable read | Phantom | Snapshot |
|---|---|---|---|---|
| READ UNCOMMITTED | **yes — really** | yes | yes | none: reads see uncommitted data |
| READ COMMITTED | no | yes | yes | fresh snapshot **per statement** |
| REPEATABLE READ *(default)* | no | no | no* | one snapshot **per transaction** |
| SERIALIZABLE | no | no | no | RR + plain SELECTs take [shared locks](/mysql/02-isolation/serializable) |

<small>\* for plain SELECTs; [locking reads and writes see the current data](/mysql/02-isolation/repeatable-read) — that asterisk is the most important character in this table.</small>

Two things to notice before the demos:

- **MySQL's default is REPEATABLE READ** — not READ COMMITTED like PostgreSQL, Oracle, and
  SQL Server. Most of what your MySQL app does runs at RR.
- The level is set with a separate statement, `SET TRANSACTION ISOLATION LEVEL …` (next
  transaction only) or `SET SESSION TRANSACTION ISOLATION LEVEL …` — there is no
  `BEGIN ISOLATION LEVEL …` one-liner.

## READ UNCOMMITTED means it

PostgreSQL accepts the READ UNCOMMITTED syntax but silently upgrades it to READ COMMITTED.
MySQL takes you at your word — and hands you data that was never committed:

::: code-group
<<< ../../../scenarios/mysql/02-isolation/dirty-read.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/02-isolation/dirty-read.py#demo{py} [Python]
:::

<!--@include: ./parts/dirty-read.md-->

There is essentially no good reason to run at this level: the 999 that B read — and might
have acted on — never existed.

## Key takeaways

- Isolation levels are per-transaction; the server default (`REPEATABLE READ`) can be changed
  per session or per transaction.
- READ UNCOMMITTED delivers real dirty reads —
  [PostgreSQL's](/postgres/02-isolation/snapshots-and-the-four-levels) never does.
- The rest of the chapter walks the ladder: [READ COMMITTED](/mysql/02-isolation/read-committed),
  [REPEATABLE READ](/mysql/02-isolation/repeatable-read),
  [SERIALIZABLE](/mysql/02-isolation/serializable) — and the
  [lost update](/mysql/02-isolation/lost-update), the anomaly your app most likely has today.

## Further reading

- [MySQL docs: Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [MySQL docs: Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)
