import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Deadlocks leave a permanent trace",
  claim:
    "Every deadlock increments pg_stat_database.deadlocks — a counter you can alert on even when nobody was watching the error logs.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100), (2, 100);
    -- Snapshot the cumulative counter before this scenario's deadlock, so the
    -- transcript can show a clean delta instead of a lifetime total.
    CREATE TABLE stats_before AS
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database();
  `,
  sessions: ["A", "B", "M"],

  async run({ A, B, M }, t) {
    // Pin the victim, as in the chapter-3 deadlock lesson, so the transcript is reproducible.
    await A`SET deadlock_timeout = '10s'`;
    await B`SET deadlock_timeout = '50ms'`;

    // #region demo
    t.note("The classic: A and B lock the same two rows in opposite order.");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = balance - 10 WHERE id = 1`;
    await B`BEGIN`;
    await B`UPDATE accounts SET balance = balance - 25 WHERE id = 2`;

    const pending = await A.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 2`;
    const err = await B.fails`UPDATE accounts SET balance = balance + 25 WHERE id = 1`;
    eq(err.code, "40P01"); // deadlock_detected
    await pending.success();
    await A`COMMIT`;
    await B`ROLLBACK`;

    t.note("The app retried, the users never noticed. But the database remembers:");
    await B`SELECT pg_stat_force_next_flush()`;
    const [delta] = await M`
      SELECT (d.deadlocks - s.deadlocks)::int AS new_deadlocks
      FROM pg_stat_database d, stats_before s
      WHERE d.datname = current_database()`;
    eq(delta!.new_deadlocks, 1);
    // #endregion demo
  },
});
