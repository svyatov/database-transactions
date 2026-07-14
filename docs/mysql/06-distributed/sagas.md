# Sagas: transactions that can't ROLLBACK

Book a flight with one provider, a hotel with another, charge a card with a third.
Three services, three databases, and no transaction spans them. A *saga* is the honest
answer: a chain of *local* transactions, where every completed step has a prepared
apology, a *compensating transaction* that semantically undoes it if a later step
fails.

## Watch a saga fail forward

The demo compresses the idea into one database so every claim stays assertable. The
two tables play the two services. The mechanics are the point: step 1 *commits for
real*, so when step 2 fails, the only way back is a new forward transaction:

<!--@include: ./parts/saga-compensation.md-->

The transcript proves three things. First, there's no isolation between steps: the
`Reader` saw the booked seat while the saga was still mid-flight. A saga's intermediate
states are public, because real transactions are
[invisible until COMMIT](/mysql/01-basics/what-is-a-transaction) but a saga commits at
every step. Design those in-between states to be presentable (`PENDING` statuses,
reserved quantities), because everyone will see them.

Second, compensation isn't rollback. The failed hotel booking rolled back locally, but the
flight seat came back only because the saga *booked it back*. A compensating transaction is
forward motion: it can fail on its own, race a customer grabbing the last seat, or need a
retry, and `seats = seats + 1` is business logic, not magic.

Third, failure is a business outcome, not an exception. Step 2 "failed" as
`0 rows affected` on a guarded UPDATE,
[the same affected-rows discipline](/mysql/05-patterns/fixing-lost-updates) as the
version-column pattern.

Each saga step should also write its progress to a saga-state table *in the same local
transaction* as the step itself, the [outbox discipline](/mysql/06-distributed/transactional-outbox)
again, so a crashed orchestrator can resume or compensate after restart instead of
leaving the trip half-booked forever.

A saga is local transactions plus compensating transactions, and every step needs an undo
*action* rather than an undo *button*: ROLLBACK is gone the moment the step commits.
There's zero isolation between steps, so the intermediate states are visible and have to be
designed rather than hidden, and each step's progress has to be persisted transactionally
or a crash strands the workflow. Compensations run against a world that kept moving while
you weren't looking, so write them with the same care as the forward path.

## Further reading

- Garcia-Molina & Salem, [*Sagas*](https://dl.acm.org/doi/10.1145/38713.38742) (SIGMOD 1987),
  the original paper
- [microservices.io: Saga](https://microservices.io/patterns/data/saga.html),
  orchestration vs. choreography, modern vocabulary
- [The same lesson on PostgreSQL](/postgres/06-distributed/sagas)
