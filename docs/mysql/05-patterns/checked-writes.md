# Checked writes

These MySQL 8.4.11 InnoDB REPEATABLE READ Scenarios support the [stock and stale-edit decisions](/concepts/protection-choices). They assert particular single-row schedules, not an application UI or all possible executions.

## Two buyers

Two buyers request four units each from a stock of five. B waits for A's UPDATE, then its condition matches no row after A commits. B rolls back; the quantity is 1. A deliberate failed-repair branch then removes the condition and decrements again, leaving -3.

<!--@include: ./parts/checked-stock.md-->

## An editing interval

Both editors load version 1 before their save transactions. A saves version 2. B's checked replacement affects zero rows, and a fresh read after rollback still shows A's edit. A deliberate failed-repair branch then uses the latest version with B's old draft, replacing A's text. The Scenario does not model a merge UI or an automatic retry policy.

<!--@include: ./parts/stale-edit.md-->

Predict related results in [two-writer practice](/mysql/02-isolation/practice-two-writers). Use the [protection guide](/concepts/protection-choices) for writer assumptions and application conflict responses.
