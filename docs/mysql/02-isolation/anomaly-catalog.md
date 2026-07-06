# The anomaly catalog

Every anomaly from this chapter, what stops it on MySQL, and the proof.

| Anomaly | What goes wrong | Stopped by | Proof |
|---|---|---|---|
| **Dirty read** | You read data that is never committed | READ COMMITTED and above | [dirty-read](/mysql/02-isolation/snapshots-and-the-four-levels#read-uncommitted-means-it) |
| **Non-repeatable read** | Same row, two reads, two answers | REPEATABLE READ (plain SELECTs) | [non-repeatable-read](/mysql/02-isolation/read-committed#non-repeatable-reads) |
| **Phantom read** | Same WHERE, new rows appear | REPEATABLE READ (plain SELECTs) | [phantom-read](/mysql/02-isolation/read-committed#phantoms) |
| **Stale current read** | UPDATE acts on data your SELECTs never showed you | nothing below SERIALIZABLE — by design ([current reads](/mysql/02-isolation/repeatable-read#current-reads-punch-holes-in-the-snapshot)) | [current-reads](/mysql/02-isolation/repeatable-read) |
| **Lost update** | Two read-modify-writes, one survives | **no level below SERIALIZABLE** — use [locking reads or atomic UPDATEs](/mysql/02-isolation/lost-update#the-fixes) | [lost-update-repeatable-read](/mysql/02-isolation/lost-update) |
| **Write skew** | Two transactions each check an invariant, jointly break it | SERIALIZABLE (via shared locks + deadlock) | [write-skew-serializable](/mysql/02-isolation/serializable) |

## The MySQL-specific pattern

Reading this table column by column, one theme emerges: on MySQL, **isolation levels protect
reads, not read-modify-write cycles**. REPEATABLE READ gives your SELECTs a perfectly stable
world — and your UPDATEs a completely different, current one. Everything in the bottom half
of the table is fixed with explicit locking or SQL-side arithmetic, not with the isolation
knob.

PostgreSQL's catalog looks different: its RR turns lost updates into retryable errors and its
SERIALIZABLE detects write skew without locks —
[compare the two tables](/postgres/02-isolation/anomaly-catalog).

## Error codes to retry on

| errno | SQLSTATE | Meaning | Where you saw it |
|---|---|---|---|
| `1213` | 40001 | Deadlock found; transaction rolled back | [SERIALIZABLE write skew](/mysql/02-isolation/serializable), [deadlocks](/mysql/03-locking/deadlocks) |
| `1205` | HY000 | Lock wait timeout; **statement** rolled back, transaction survives | [lock timeouts](/mysql/03-locking/nowait-skip-locked) |

## Further reading

- [MySQL docs: Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
