import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Finding long and idle transactions",
  claim:
    "Three pg_stat_activity queries find the forgotten transaction: the oldest xact_start, sessions sitting idle in transaction, and the backend_xmin that pins VACUUM's horizon.",
  setup: `
    CREATE TABLE orders (id int PRIMARY KEY, total int NOT NULL);
    INSERT INTO orders VALUES (1, 90), (2, 75);
  `,
  sessions: ["A", "M"],

  async run({ A, M }, t) {
    // #region demo
    t.note("A starts a 'quick report' at REPEATABLE READ… and never gets around to committing.");
    await A`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    await A`SELECT count(*)::int AS orders FROM orders`;
    // #endregion demo

    await Bun.sleep(1200); // let the forgotten transaction age past the detector's threshold

    // #region detect
    t.note("Detector 1 — the oldest open transaction, and how long it's been open:");
    const oldest = await M`
      SELECT application_name, state, now() - xact_start > interval '1 second' AS older_than_1s
      FROM pg_stat_activity
      WHERE xact_start IS NOT NULL AND pid <> pg_backend_pid()
      ORDER BY xact_start LIMIT 1`;
    eq(oldest, [{ application_name: "A", state: "idle in transaction", older_than_1s: true }]);

    t.note("Detector 2 — sessions holding a transaction open while doing nothing:");
    const idle = await M`
      SELECT application_name
      FROM pg_stat_activity
      WHERE state = 'idle in transaction' AND now() - state_change > interval '1 second'`;
    eq(idle, [{ application_name: "A" }]);

    t.note("Detector 3 — the reason it matters even for a read-only report: A's snapshot (backend_xmin) is what VACUUM must preserve.");
    const horizon = await M`
      SELECT application_name, backend_xid IS NOT NULL AS wrote_anything,
             backend_xmin IS NOT NULL AS pins_vacuum_horizon
      FROM pg_stat_activity
      WHERE backend_xmin IS NOT NULL AND pid <> pg_backend_pid()`;
    eq(horizon, [{ application_name: "A", wrote_anything: false, pins_vacuum_horizon: true }]);

    await A`COMMIT`;
    // #endregion detect
  },
});
