import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "SKIP LOCKED: take what's free, skip what's taken",
  claim:
    "SELECT ... FOR UPDATE SKIP LOCKED silently skips locked rows, so concurrent workers each grab a different row without ever waiting — the backbone of Postgres job queues.",
  setup: `
    CREATE TABLE jobs (id int PRIMARY KEY, task text NOT NULL);
    INSERT INTO jobs VALUES (1, 'send email'), (2, 'resize image'), (3, 'build report');
  `,
  sessions: ["A", "B", "C", "D"],

  async run({ A, B, C, D }, t) {
    // #region demo
    t.note("Four workers run the exact same query at the same time.");
    await A`BEGIN`;
    const [a] = await A`SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(a!.id, 1);

    await B`BEGIN`;
    const [b] = await B`SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(b!.id, 2); // job 1 is locked by A — skipped, no waiting

    await C`BEGIN`;
    const [c] = await C`SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(c!.id, 3);

    t.note("Worker D finds the queue empty — an instant answer, not a wait.");
    const none = await D`SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(none.length, 0);

    t.note("A worker crash (rollback) puts its job straight back on the queue.");
    await A`ROLLBACK`;
    const [retry] = await D`SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(retry!.id, 1);

    await B`COMMIT`;
    await C`COMMIT`;
    // #endregion
  },
});
