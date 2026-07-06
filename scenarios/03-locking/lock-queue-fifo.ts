import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Waiters form a queue — first come, first locked",
  claim:
    "Sessions waiting for the same row lock queue up: when the holder commits, the lock goes to the first waiter, and everyone else keeps waiting behind it.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'shared', 100);
  `,
  sessions: ["A", "B", "C", "M"],

  async run({ A, B, C, M }, t) {
    // #region demo
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = balance + 1 WHERE id = 1`;

    await B`BEGIN`;
    const second = await B.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 1`;
    const third = await C.blocked`UPDATE accounts SET balance = balance + 100 WHERE id = 1`;

    t.note("A fourth session, M, can watch the pile-up in pg_stat_activity.");
    const before = await M`
      SELECT application_name AS waiting, pg_blocking_pids(pid) AS blocked_by
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
      ORDER BY application_name`;
    eq(before.map((r) => r.waiting), ["B", "C"]);

    t.note("A commits. The lock goes to B — the head of the queue — not to C.");
    await A`COMMIT`;
    await second.success();

    const after = await M`
      SELECT application_name AS waiting, pg_blocking_pids(pid) AS blocked_by
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
      ORDER BY application_name`;
    eq(after.map((r) => r.waiting), ["C"]); // C is still in line, now behind B

    await B`COMMIT`;
    await third.success();

    const [final] = await C`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 211); // 100 + 1 + 10 + 100 — every update landed, in queue order
    // #endregion
  },
});
