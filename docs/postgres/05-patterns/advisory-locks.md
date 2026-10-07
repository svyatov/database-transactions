# Advisory locks: locking ideas, not rows

Advisory keys represent application-defined work. This example uses
exclusive, database-local keys and no tables. All participating workers
must agree on the key and lock protocol; advisory locking does not
automatically lock application data.

<!--@include: ./parts/advisory-locks.md-->

B's try-lock returns false while A holds key 42. A blocking request waits
until A unlocks. The try-lock avoids an advisory-lock wait; the scenario
does not measure end-to-end latency. The
[PostgreSQL 18 contract](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS)
also permits shared modes and repeated acquisitions by the same session.
Repeated acquisitions need matching unlocks.

## Session locks vs. transaction locks

COMMIT leaves A's session lock on key 9 held. A's transaction lock on key 7
prevents B's acquisition until A commits; then B's try-lock succeeds.
These are Demonstrated behaviors. The manual documents that session locks
survive rollback and end on explicit release or session termination.
Transaction-level locks end with the transaction. Rollback and holder
termination are Documented contracts, not executed cases here. A lost
connection is not necessarily detected immediately.

Prefer a transaction-level lock for work contained in one transaction;
use session locks when work must span transactions and arrange explicit
cleanup. This is design advice, not a universal workload rule.
The [function contract](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
defines separate key spaces for one 64-bit key and two 32-bit keys.
Within a database and key space, features that choose the same key contend.
Maintain an application key registry to avoid accidental collisions.

## Further reading

- [PostgreSQL 18: Advisory Locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS)
- [PostgreSQL 18: Advisory Lock Functions](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [The same lesson on MySQL](/mysql/05-patterns/advisory-locks)
