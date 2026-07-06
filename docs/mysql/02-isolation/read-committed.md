# Read Committed

At READ COMMITTED, every statement gets a **fresh snapshot**: it sees everything committed by
the time *it* starts. Within one transaction, two identical reads can disagree — because the
world moved between them.

## Non-repeatable reads

::: code-group
<<< ../../../scenarios/mysql/02-isolation/non-repeatable-read.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/02-isolation/non-repeatable-read.py#demo{py} [Python]
:::

Readers never block — but two writers to the same row do queue up:

::: code-group
<<< ../../../scenarios/mysql/02-isolation/non-repeatable-read.ts#blocking{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/02-isolation/non-repeatable-read.py#blocking{py} [Python]
:::

<!--@include: ./parts/non-repeatable-read.md-->

## Phantoms

The same effect on a *set* of rows: a `WHERE` clause can match rows in the second reading
that didn't exist in the first.

::: code-group
<<< ../../../scenarios/mysql/02-isolation/phantom-read.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/02-isolation/phantom-read.py#demo{py} [Python]
:::

<!--@include: ./parts/phantom-read.md-->

## After the wait, the re-check

When an UPDATE waits for a row lock and finally gets it, the row may no longer match its
`WHERE` clause. READ COMMITTED re-evaluates and silently skips it
([semi-consistent read](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)):

::: code-group
<<< ../../../scenarios/mysql/02-isolation/update-recheck.ts#demo{ts} [TypeScript]
<<< ../../../python/scenarios/mysql/02-isolation/update-recheck.py#demo{py} [Python]
:::

<!--@include: ./parts/update-recheck.md-->

## Key takeaways

- Fresh snapshot per statement: no dirty reads, but non-repeatable reads and phantoms are
  routine. If one report must be internally consistent, run it at
  [REPEATABLE READ](/mysql/02-isolation/repeatable-read).
- `Query OK, 0 rows affected` after a lock wait may mean the row *escaped* — code that assumes
  "I updated exactly the rows I saw" is wrong at this level.
- At READ COMMITTED, InnoDB also takes fewer gap locks than at RR — one reason some heavy-write
  shops choose it. Locking is [chapter 3](/mysql/03-locking/row-locks).

## Further reading

- [MySQL docs: READ COMMITTED](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html#isolevel_read-committed)
