import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "A job queue on FOR UPDATE SKIP LOCKED",
  claim:
    "The full worker loop — claim with FOR UPDATE SKIP LOCKED, work, mark done, commit — never double-processes a job and never loses one: a worker crash returns its job to the queue automatically.",
  setup: `
    CREATE TABLE jobs (id int PRIMARY KEY, task text NOT NULL, state text NOT NULL DEFAULT 'queued');
    INSERT INTO jobs (id, task) VALUES (1, 'send welcome email'), (2, 'generate invoice');
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Two workers run the same loop: claim the oldest queued job, do the work, mark it done, commit.");
    await A`BEGIN`;
    const [ja] = await A`
      SELECT id, task FROM jobs WHERE state = 'queued'
      ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(ja!.id, 1);

    await B`BEGIN`;
    const [jb] = await B`
      SELECT id, task FROM jobs WHERE state = 'queued'
      ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(jb!.id, 2); // job 1 is claimed — skipped without waiting

    t.note("A finishes and commits. B crashes mid-job — its claim evaporates with its transaction.");
    await A`UPDATE jobs SET state = 'done' WHERE id = 1`;
    await A`COMMIT`;
    await B`ROLLBACK`;

    t.note("A restarted worker finds job 2 right back in the queue — nothing was lost, nothing ran twice.");
    await B`BEGIN`;
    const [again] = await B`
      SELECT id, task FROM jobs WHERE state = 'queued'
      ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(again!.id, 2);
    await B`UPDATE jobs SET state = 'done' WHERE id = 2`;
    await B`COMMIT`;

    const done = await A`SELECT id, state FROM jobs ORDER BY id`;
    eq(done, [
      { id: 1, state: "done" },
      { id: 2, state: "done" },
    ]);
    // #endregion
  },
});
