import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Deadlock avoidance: lock rows in a consistent order",
  claim:
    "The same two opposite-direction transfers cannot deadlock if both transactions lock the rows in the same (id) order first — the second simply waits its turn.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Both transfers grab *all* their row locks up front, ordered by id.");
    await A`BEGIN`;
    await A`SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE`;

    await B`BEGIN`;
    const queued = await B.blocked`SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE`;

    t.note("No cycle is possible: B parks at the first row and holds nothing A needs.");
    await A`UPDATE accounts SET balance = balance - 10 WHERE id = 1`;
    await A`UPDATE accounts SET balance = balance + 10 WHERE id = 2`;
    await A`COMMIT`;

    await queued.success();
    await B`UPDATE accounts SET balance = balance - 25 WHERE id = 2`;
    await B`UPDATE accounts SET balance = balance + 25 WHERE id = 1`;
    await B`COMMIT`;

    const rows = await A`SELECT owner, balance FROM accounts ORDER BY id`;
    eq(rows, [
      { owner: "alice", balance: 115 },
      { owner: "bob", balance: 85 },
    ]); // both transfers landed — same workload, zero deadlocks
    // #endregion demo
  },
});
