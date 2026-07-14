# ORM pitfalls

ORMs are fine. What bites is the transaction machinery they hide. The pitfalls from
[the PostgreSQL lesson](/postgres/05-patterns/orm-pitfalls) (transactions held open
across slow I/O, read-modify-write without protection, blind trust in default isolation)
all apply on MySQL, two of them with worse defaults. And MySQL adds a fourth of its own:
your migration tool's "transactional" migrations aren't.

## Pitfall #1: DDL in a "transaction" is the migration lie

Every serious framework wraps migrations in a transaction, and on PostgreSQL that means a
[failed migration rolls back cleanly](/postgres/01-basics/begin-commit-rollback): schema
*and* data. On MySQL the wrapper is decorative. The
[manual](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html): DDL statements
"implicitly end any transaction active in the current session, as if you had done a
`COMMIT` before executing the statement."

<!--@include: ./parts/implicit-commit.md-->

A migration that inserts data, alters a table, then fails leaves the database in a state
*no version of your code describes*: half-migrated, permanently. Write MySQL migrations
to be *re-runnable* (idempotent steps, one DDL per migration) instead of assuming
atomicity the engine doesn't offer.

## Pitfall #2: the transaction that outlives the query

Transaction-per-request middleware opens a transaction; the handler then awaits a payment
API or renders a template. The database sees a session idle in transaction (holding
[row locks](/mysql/03-locking/row-locks), blocking [DDL](/mysql/03-locking/table-locks-and-ddl)
via metadata locks, and [pinning undo history](/mysql/04-mvcc/history-list-length)) while
your code isn't talking to it at all. MySQL makes this one *harder to survive* than
PostgreSQL: there is no `idle_in_transaction_session_timeout` to kill the offender. The
production chapter shows how to find the culprits yourself. The real fix is upstream: no
network I/O inside a transaction, ever.

## Pitfall #3: no transaction where you assumed one

Without an explicit block, most ORMs run each `save()` as its own autocommitted statement,
so *load entity, change field, save* is exactly chapter 2's
[read-modify-write lost update](/mysql/02-isolation/lost-update), writing back every stale
field the object was loaded with. The fixes are the
[previous lesson's](/mysql/05-patterns/fixing-lost-updates); ORMs ship two of them as
"optimistic locking" (version column) and a `lock`/`forUpdate` query option. They only
work if you turn them on, and on MySQL you can't lean on REPEATABLE READ to catch what
you missed, [as PostgreSQL's would](/postgres/02-isolation/lost-update).

## Pitfall #4: trusting default isolation

An ORM transaction block gives you REPEATABLE READ (MySQL's default), which sounds
stronger than PostgreSQL's READ COMMITTED and is, for plain reads. But every write in it
is a [current read](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot),
lost updates [pass silently](/mysql/02-isolation/lost-update), and there's no
`40001` to tell you the snapshot betrayed you. If a unit of work needs SERIALIZABLE, say
so per-transaction, and then own the [`1213` retry loop](/mysql/05-patterns/retrying-deadlocks),
because the ORM won't rerun your business logic for you.

Four habits keep these from biting. MySQL has no transactional DDL, so every migration step
that touches the schema commits everything before it: design migrations to re-run, never
to roll back. An ORM transaction stays open from its first statement until your code
returns, and with no idle-in-transaction timeout to save you, keeping network I/O out of it
falls to you. Object-style read-modify-write is a lost update by default until you turn on
a version column or a locking read, and the isolation level and the `1213` retry loop are
your job, not the ORM's.

## Further reading

- [MySQL docs: Statements That Cause an Implicit Commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
- [The same lesson on PostgreSQL](/postgres/05-patterns/orm-pitfalls)
