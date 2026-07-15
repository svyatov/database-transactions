---
layout: home
description: "Learn database transactions from verified, runnable examples: isolation levels, anomalies, locking, MVCC, and real-world concurrency patterns on PostgreSQL and MySQL, every claim proven against a real database."

hero:
  name: Database Transactions
  text: Learn from verified, runnable examples
  tagline: Isolation levels, anomalies, locking, MVCC, and real-world concurrency patterns, every claim on this site is proven by code that just ran against a real database.
  actions:
    - theme: brand
      text: Start here
      link: /start-here
    - theme: alt
      text: How this site works
      link: /about/methodology

features:
  - icon: ✅
    title: Verified, not vibed
    details: Nothing here is hand-waved. Every transcript came out of a real Postgres or MySQL run, and CI runs them all again on every commit. The day a claim stops being true, the build goes red.
  - icon: 🧪
    title: Run it yourself
    details: "`docker compose up`, then `bun test`. Every lesson is a real scenario you can run, poke at, and break on purpose. Flip an isolation level and watch the anomaly walk right back in."
  - icon: 🧠
    title: Focused on what breaks
    details: "You already write transactions. This digs into the parts that go wrong under load: lost updates, deadlocks, phantom reads, and the fixes that actually hold up."
---
