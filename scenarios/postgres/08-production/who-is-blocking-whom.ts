import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Who is blocking whom",
  claim:
    "One join on pg_stat_activity + pg_blocking_pids() names the blocker, shows that it's sitting idle in transaction, and shows the last statement it ran — and pg_terminate_backend() drains the queue.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "B", "M"],

  async run({ A, B, M }, t) {
    // #region demo
    t.note("A updates a row and then… goes to lunch. The transaction stays open.");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 200 WHERE id = 1`;

    const pending = await B.blocked`UPDATE accounts SET balance = 300 WHERE id = 1`;

    t.note("Someone pages you: 'updates are hanging'. This is the query you paste:");
    const triage = await M`
      SELECT waiter.application_name AS waiter,
             waiter.query            AS waiting_query,
             blocker.application_name AS blocker,
             blocker.state             AS blocker_state,
             blocker.query             AS blocker_last_query
      FROM pg_stat_activity waiter
      JOIN pg_stat_activity blocker ON blocker.pid = ANY (pg_blocking_pids(waiter.pid))
      WHERE waiter.wait_event_type = 'Lock'`;
    eq(triage, [
      {
        waiter: "B",
        waiting_query: "UPDATE accounts SET balance = 300 WHERE id = 1",
        blocker: "A",
        blocker_state: "idle in transaction",
        blocker_last_query: "UPDATE accounts SET balance = 200 WHERE id = 1",
      },
    ]);

    t.note("The culprit isn't running anything — it's IDLE, holding locks. The fix is blunt:");
    const [kill] = await M`
      SELECT pg_terminate_backend(pid) AS terminated
      FROM pg_stat_activity WHERE application_name = 'A'`;
    eq(kill!.terminated, true);

    t.note("A's transaction dies and rolls back; B gets the lock and finishes at last.");
    const rows = await pending.success();
    eq(rows.count, 1);
    const [after] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(after!.balance, 300); // A's 200 rolled back with its termination; B's 300 committed
    // #endregion
  },
});
