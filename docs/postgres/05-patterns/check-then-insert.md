# Check-then-insert: the race

An application check does not replace a uniqueness constraint. In this
READ COMMITTED schedule, with no UNIQUE email constraint, both checks see
zero rows and both requests insert. It does not test every isolation
level or every check-and-insert protocol.

## Watch the duplicate land

<!--@include: ./parts/check-then-insert-race.md-->

The final count asserts two copies of the email. No waiting or error is
observed in this schedule. The conclusion applies to the shown protocol,
not a claim that arbitrary INSERT statements can never wait.

## The fix is a constraint, not cleverer code

<!--@include: ./parts/on-conflict.md-->

With UNIQUE on the non-NULL email, B waits for A's insertion to commit,
then fails with `23505`. DO NOTHING affects zero rows. DO UPDATE returns
the existing row with id 1. These are Demonstrated behaviors.

The PostgreSQL 18 [INSERT contract](https://www.postgresql.org/docs/18/sql-insert.html#SQL-ON-CONFLICT)
defines the alternative conflict actions and RETURNING rows. It documents
an atomic insert-or-update outcome for DO UPDATE when there is no
independent error; that does not promise no waits or no serialization
failures. Scope the constraint to the business key, including its NULL
and comparison semantics. See the [constraint contract](https://www.postgresql.org/docs/18/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS).

A check-first query can improve the user message, but UNIQUE arbitrates
concurrent conflicting inserts. ON CONFLICT handles the selected conflict;
other failures still need recovery. The same mechanism gates
[database-local idempotency](/postgres/05-patterns/idempotency).

## Further reading

- [PostgreSQL 18: INSERT](https://www.postgresql.org/docs/18/sql-insert.html#SQL-ON-CONFLICT)
- [The same lesson on MySQL](/mysql/05-patterns/check-then-insert)

The [reconstructed support assessment](/audits/40-reconstructed-support#postgresql-patterns) records the exact manual support and execution limits for this lesson.
