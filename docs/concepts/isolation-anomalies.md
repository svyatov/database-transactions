---
description: "Transaction anomaly names and reference links, with separate demonstrated schedules, documented exclusions, and unexecuted variants."
---

# The anomaly catalog

Every isolation anomaly with a formal name. The codes (G0, G1a, …) come from Adya's
dependency-graph formalism, popularized by [Hermitage](https://github.com/ept/hermitage),
Martin Kleppmann's cross-database isolation test suite. This reference retains the named cases but does not claim complete Hermitage execution coverage; the engine catalogs state unexecuted variants explicitly.

| Code | Anomaly | In one line |
|---|---|---|
| G0 | [Dirty write](#dirty-write-g0) | two uncommitted transactions interleave writes to the same rows |
| G1a | [Dirty read](/concepts/dirty-read) | reading data that is later rolled back |
| G1b | [Intermediate read](#intermediate-read-g1b) | reading a draft the writer later overwrites |
| G1c | [Circular information flow](#circular-information-flow-g1c) | two transactions each read the other's uncommitted writes |
| OTV | [Observed transaction vanishes](#observed-transaction-vanishes-otv) | a committed transaction is visible in pieces |
| P2 | [Non-repeatable read](/concepts/non-repeatable-read) | the same row read twice gives two answers |
| G-single | [Read skew](/concepts/non-repeatable-read#read-skew) | a multi-row combination that existed at no point in time |
| PMP | [Phantom read](/concepts/phantom-read) | the same range query returns new rows |
| P4 | [Lost update](/concepts/lost-update) | read-modify-write silently overwrites a concurrent update |
| G2-item / G2 | [Write skew](/concepts/write-skew) | two transactions jointly break an invariant each one checked |
| — | [Read-only anomaly](#the-read-only-anomaly) | even a pure report can observe an impossible state |

Which isolation level stops which anomaly is an *engine* answer, not a *standard* answer.
The per-engine answer sheets distinguish D (asserted schedule), M (Documented contract), † (explained Entailed guarantee), and unexecuted cells:
[PostgreSQL's answers](/postgres/02-isolation/anomaly-catalog) ·
[MySQL's answers](/mysql/02-isolation/anomaly-catalog).

## What the standard's table doesn't tell you

The SQL standard's three-anomaly table (dirty / non-repeatable / phantom, see
[isolation levels](/concepts/isolation-levels)) dates from 1992. Lost updates, write skew,
and the read-only anomaly were formalized later¹, and they're the ones that actually bite in
modern applications, because they emerge from *application logic* (read, decide, write)
rather than from raw statement visibility.

¹ Berenson et al., [*A Critique of ANSI SQL Isolation Levels*](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/) (1995);
Adya, [*Weak Consistency: A Generalized Theory and Optimistic Implementations for Distributed Transactions*](https://pmg.csail.mit.edu/papers/adya-phd.pdf) (MIT PhD thesis, 1999), the source of the G-codes;
Fekete et al., [*Making Snapshot Isolation Serializable*](https://doi.org/10.1145/1071610.1071615)
(ACM TODS, 2005).

## The obscure ones

The five anomalies below rarely make it into blog posts, because on most databases at most
levels they can't happen. They're worth knowing precisely because *where* they can
happen tells you what a level is really made of.

### Dirty write (G0)

Overwriting another transaction's uncommitted target is the dirty-write event. Interleaving statements or a mixed final state alone is not its definition. The displayed UPDATE waits are demonstrated at the catalogs' stated levels. † The all-level exclusion follows from their documented exclusive target locks, which require the first writer to end before a conflicting overwrite. No Transcript executes every level or excludes every read/write cycle.
See it proven: [PostgreSQL](/postgres/02-isolation/anomaly-catalog#dirty-writes-g0) ·
[MySQL](/mysql/02-isolation/anomaly-catalog#dirty-writes-g0).

### Intermediate read (G1b)

Reading a *draft*: the writer changes a value twice, and you catch the version that no
committed history ever contained. Impossible from READ COMMITTED up on both engines, but
MySQL's READ UNCOMMITTED really serves it.
See it: [PostgreSQL](/postgres/02-isolation/anomaly-catalog#intermediate-reads-g1b) ·
[MySQL](/mysql/02-isolation/anomaly-catalog#intermediate-reads-g1b).

### Circular information flow (G1c)

Two concurrent transactions each read the other's uncommitted writes, an information
exchange no serial order could explain.
See it: [PostgreSQL](/postgres/02-isolation/anomaly-catalog#circular-information-flow-g1c) ·
[MySQL](/mysql/02-isolation/anomaly-catalog#circular-information-flow-g1c).

### Observed transaction vanishes (OTV)

A committed transaction should be visible as a whole or not at all. Under dirty reads it can
show through *in pieces*: one row already overwritten by an uncommitted successor, the other
still visible.
See it: [PostgreSQL](/postgres/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv) ·
[MySQL](/mysql/02-isolation/anomaly-catalog#observed-transaction-vanishes-otv).

### The read-only anomaly

A transaction that only reads can observe a result with no compatible serial ordering of the committed participating transactions. The PostgreSQL demonstration models a report with SELECT results, not printing or publication. SERIALIZABLE supplies documented serial equivalence; other suitably designed coordination can also protect a particular application rule. MySQL has no corresponding read-only Scenario catalogued here.
See it: [PostgreSQL](/postgres/02-isolation/serializable#it-even-protects-read-only-transactions).

## Further reading

- [Hermitage](https://github.com/ept/hermitage): runnable isolation tests for PostgreSQL,
  MySQL, Oracle, and more; it is a separate suite, not claimed full execution coverage here
- [PostgreSQL's anomaly catalog](/postgres/02-isolation/anomaly-catalog) ·
  [MySQL's anomaly catalog](/mysql/02-isolation/anomaly-catalog): same anomalies,
  meaningfully different answers
