# Sagas: transactions that can't ROLLBACK

Book a flight with one provider, a hotel with another, charge a card with a third.
Three services, three databases — and no transaction that spans them. A **saga** is
the honest answer: a chain of *local* transactions, where every completed step has a
prepared apology — a **compensating transaction** that semantically undoes it if a
later step fails.

## Watch a saga fail forward

The demo compresses the idea into one database so every claim stays assertable — the
two tables play the two services. The mechanics are the point: step 1 *commits for
real*, so when step 2 fails, the only way back is a new forward transaction:

<!--@include: ./parts/saga-compensation.md-->

## What the transcript just proved

- **Each step commits immediately.** There is no long-lived transaction holding
  [locks](/postgres/03-locking/row-locks) or [pinning VACUUM](/postgres/04-mvcc/long-transactions)
  across service calls — that's the whole reason sagas exist.
- **A saga has no isolation.** `Reader` saw the booked seat *between* steps — a state
  the saga later revoked. Every anomaly chapter 2 catalogued between statements can now
  happen between *steps*, and no isolation level can help, because there is no
  enclosing transaction. If another traveler grabs a seat based on what they saw
  mid-saga, that's yours to design for.
- **Compensation is not ROLLBACK.** `seats = seats + 1` is ordinary committed history —
  the anomaly window really happened and stays visible in the log. Compensations must be
  written per step, must tolerate being retried (make them
  [idempotent](/postgres/05-patterns/idempotency)), and some steps — an email sent, cash
  dispensed — simply have none. Order the saga so irreversible steps come last.

## Key takeaways

- A saga trades one impossible distributed transaction for N possible local ones plus
  N compensations. You write — and test — the compensations.
- Isolation is gone between steps. Name the intermediate states, decide who may see
  them, and put irreversible steps at the end.
- Steps and compensations travel between services as messages, so the
  [outbox](/postgres/06-distributed/transactional-outbox) is the saga's transport: each step's
  "done" event commits atomically with the step itself.

## Further reading

- [Garcia-Molina & Salem, *Sagas* (1987)](https://dl.acm.org/doi/10.1145/38713.38742) —
  the original paper; the word predates microservices by three decades
- [microservices.io: Saga](https://microservices.io/patterns/data/saga.html) —
  orchestration vs. choreography, in detail
- [The same lesson on MySQL](/mysql/06-distributed/sagas)
