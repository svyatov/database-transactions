# Sagas: transactions that can't ROLLBACK

Book a flight with one provider, a hotel with another, charge a card with a third.
Three services, three databases — and no transaction that spans them. A *saga* is
the honest answer: a chain of *local* transactions, where every completed step has a
prepared apology — a *compensating transaction* that semantically undoes it if a
later step fails.

## Watch a saga fail forward

The demo compresses the idea into one database so every claim stays assertable — the
two tables play the two services. The mechanics are the point: step 1 *commits for
real*, so when step 2 fails, the only way back is a new forward transaction:

<!--@include: ./parts/saga-compensation.md-->

## What the transcript just proved

Three things in that transcript are worth naming. Each step commits immediately, so
there's no long-lived transaction holding [locks](/postgres/03-locking/row-locks) or
[pinning VACUUM](/postgres/04-mvcc/long-transactions) across service calls — which is the
whole reason sagas exist. A saga also has no isolation: `Reader` saw the booked seat
*between* steps, a state the saga later revoked, so every anomaly chapter 2 catalogued
between statements can now happen between *steps*, and no isolation level can help,
because there's no enclosing transaction to reach for. If another traveler grabs a seat
based on what they saw mid-saga, that's yours to design for.

And compensation is not ROLLBACK. `seats = seats + 1` is ordinary committed history — the
anomaly window really happened and stays visible in the log. Compensations have to be
written per step and have to tolerate being retried, so make them
[idempotent](/postgres/05-patterns/idempotency); some steps, an email sent or cash
dispensed, have none at all, which is why you order the saga to put irreversible steps
last.

Underneath it all, a saga trades one impossible distributed transaction for N possible
local ones plus N compensations you write and test yourself. Isolation is gone between
the steps, so name the intermediate states, decide who is allowed to see them, and push
irreversible steps to the end. And because steps and their compensations travel between
services as messages, the [outbox](/postgres/06-distributed/transactional-outbox) is the
saga's transport: each step's "done" event commits atomically with the step that produced
it.

## Further reading

- [Garcia-Molina & Salem, *Sagas* (1987)](https://dl.acm.org/doi/10.1145/38713.38742) —
  the original paper; the word predates microservices by three decades
- [microservices.io: Saga](https://microservices.io/patterns/data/saga.html) —
  orchestration vs. choreography, in detail
- [The same lesson on MySQL](/mysql/06-distributed/sagas)
