# Row locks

MVCC keeps plain readers lock-free, but writers — and readers who intend to write — take
**row locks**. InnoDB's are simple: a row lock is either **shared (S)** or **exclusive (X)**.
S coexists with S; everything else conflicts.

## FOR UPDATE blocks writers, never readers

<!--@include: ./parts/for-update-blocks.md-->

## The whole matrix: S and X

PostgreSQL has [a four-mode ladder](/postgres/03-locking/row-locks) of row locks. InnoDB has
two strengths, and the full compatibility story fits in one demo:

<!--@include: ./parts/lock-mode-matrix.md-->

## Foreign keys take row locks for you

Every `INSERT` into a child table locks the referenced parent row with an S lock — that's how
InnoDB guarantees the parent can't vanish mid-insert. With no weaker lock available, even an
innocent update of the parent's *other columns* has to wait:

<!--@include: ./parts/fk-shared-lock.md-->

::: warning The silent no-op FK
MySQL **silently ignores** the inline `REFERENCES` syntax
(`customer_id int REFERENCES customers (id)` creates *no constraint at all*). Foreign keys
must be declared table-level: `FOREIGN KEY (customer_id) REFERENCES customers (id)`.
:::

## Key takeaways

- Two strengths only: S (shared) and X (exclusive). `FOR SHARE` takes S, `FOR UPDATE` and all
  writes take X.
- Plain SELECTs take no row locks at any level below SERIALIZABLE — readers never wait for
  writers.
- FK checks lock parent rows with S. Hot parent + busy children = a queue PostgreSQL wouldn't
  have (its `FOR KEY SHARE` coexists with non-key updates).
- Row locks live until COMMIT/ROLLBACK — never mid-transaction. Keep write transactions short.

## Further reading

- [MySQL docs: InnoDB Locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
- [MySQL docs: Locks Set by Different SQL Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
- [Gap locks](/mysql/03-locking/gap-locks) — the other half of InnoDB locking: locking the spaces between rows
