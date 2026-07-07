---
layout: home
description: Learn database transactions from verified, runnable examples — isolation levels, anomalies, locking, MVCC, and real-world concurrency patterns on PostgreSQL and MySQL, every claim proven against a real database.

hero:
  name: Database Transactions
  text: Learn from verified, runnable examples
  tagline: Isolation levels, anomalies, locking, MVCC, and real-world concurrency patterns — every claim on this site is proven by code that just ran against a real database.
  actions:
    - theme: brand
      text: Learn PostgreSQL transactions
      link: /postgres/01-basics/what-is-a-transaction
    - theme: brand
      text: Learn MySQL transactions
      link: /mysql/01-basics/what-is-a-transaction
    - theme: alt
      text: What this is & how it works
      link: /about/methodology

features:
  - icon: ✅
    title: Verified, not vibed
    details: Every session transcript is generated from a real run. CI re-verifies all of them on every change — the site cannot drift from actual database behavior.
  - icon: 🧪
    title: Runnable at home
    details: Clone the repo, `docker compose up`, `bun test`. Every lesson is an executable scenario you can tweak, break, and learn from.
  - icon: 🧠
    title: Built for working devs
    details: You already use transactions. These lessons show you the anomalies hiding in your code — and the patterns that fix them.
---
