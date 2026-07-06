import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "The classic migration outage, in four statements",
  claim:
    "An ALTER TABLE queued behind one long transaction blocks every later query on that table — even plain SELECTs — because they must queue behind its ACCESS EXCLUSIVE request.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B", "C", "M"],

  async run({ A, B, C, M }, t) {
    // #region demo
    t.note("A is any long-lived transaction that has touched the table — a report, a stuck job…");
    await A`BEGIN`;
    await A`SELECT balance FROM accounts WHERE id = 1`;

    t.note("The migration needs ACCESS EXCLUSIVE, so it waits for A. Expected. But now —");
    const migration = await B.blocked`ALTER TABLE accounts ADD COLUMN note text`;

    t.note("— every new query on the table queues behind the *waiting* ALTER. This is the outage.");
    const read = await C.blocked`SELECT balance FROM accounts WHERE id = 1`;

    const chain = await M`
      SELECT waiter.application_name AS waiter, blocker.application_name AS blocker
      FROM pg_stat_activity waiter
      JOIN pg_stat_activity blocker ON blocker.pid = ANY (pg_blocking_pids(waiter.pid))
      WHERE waiter.wait_event_type = 'Lock'
      ORDER BY waiter.application_name, blocker.application_name`;
    eq(chain.map((r) => `${r.waiter}←${r.blocker}`), ["B←A", "C←B"]);

    t.note("Only when A ends does the pile-up drain — migration first, then the reads.");
    await A`COMMIT`;
    await migration.success();
    await read.success();
    // #endregion demo
  },
});
