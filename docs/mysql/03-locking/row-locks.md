# Row locks

MVCC keeps plain readers lock-free, but writers (and readers who intend to write) take
*row locks*. InnoDB's are simple: a row lock is either *shared* (S) or *exclusive* (X).
S coexists with S; everything else conflicts.

## FOR UPDATE blocks writers, never readers

<!--@include: ./parts/for-update-blocks.md-->

## The whole matrix: S and X

PostgreSQL has [a four-mode ladder](/postgres/03-locking/row-locks) of row locks. InnoDB has
two strengths, and the full compatibility story fits in one demo:

<!--@include: ./parts/lock-mode-matrix.md-->

## Foreign keys take row locks for you

Every `INSERT` into a child table locks the referenced parent row with an S lock: that's how
InnoDB guarantees the parent can't vanish mid-insert. With no weaker lock available, even an
innocent update of the parent's *other columns* has to wait:

<!--@include: ./parts/fk-shared-lock.md-->

::: warning The silent no-op FK
MySQL silently ignores the inline `REFERENCES` syntax:
`customer_id int REFERENCES customers (id)` creates no constraint at all. Foreign keys
must be declared at table level: `FOREIGN KEY (customer_id) REFERENCES customers (id)`.
:::

InnoDB's row-lock story fits in two strengths: S coexists with S, X conflicts with
everything, and that's the entire compatibility matrix. `FOR SHARE` takes S; `FOR UPDATE` and
every write take X; plain SELECTs stay out of it below SERIALIZABLE, which is why readers never
wait for writers. The sharp edge is the foreign key: a child insert takes a full S lock on the
parent row that even PostgreSQL's `FOR KEY SHARE` would have let slide, so a hot parent under
busy children becomes a queue Postgres wouldn't have. All of these locks live until `COMMIT` or
`ROLLBACK`, never released mid-transaction, so keeping write transactions short is the whole
game. Rows are only half of InnoDB locking, though: at REPEATABLE READ it also locks the empty
spaces between them, which is where [gap locks](/mysql/03-locking/gap-locks) come in.

## Further reading

- [MySQL docs: InnoDB Locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)
- [MySQL docs: Locks Set by Different SQL Statements](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
- [Gap locks](/mysql/03-locking/gap-locks), the other half of InnoDB locking: locking the spaces between rows
- [The same lesson on PostgreSQL](/postgres/03-locking/row-locks)
