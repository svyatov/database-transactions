---
layout: home
description: "Learn PostgreSQL and MySQL transactions from asserted database runs, documented contracts, and marked derivations."

hero:
  name: Database Transactions
  text: Learn from verified, runnable examples
  tagline: Isolation levels, anomalies, locking, MVCC, and concurrency patterns, with asserted database runs, documented contracts, and marked derivations.
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
    details: Scenario transcripts come from real PostgreSQL or MySQL runs. Database-relevant CI changes replay the schedules and reject artifact drift. Manual contracts and marked derivations support broader explanations.
  - icon: 🧪
    title: Run it yourself
    details: "`docker compose up -d --wait`, then `bun test`. Replay the Scenarios and change their schedules or isolation levels to test your predictions. Some reference topics use manual support rather than a Scenario."
  - icon: 🧠
    title: Focused on what breaks
    details: "Study lost updates, deadlocks, phantom reads, and repairs with their transaction and writer boundaries stated. These demonstrations do not measure production workload performance."
---
