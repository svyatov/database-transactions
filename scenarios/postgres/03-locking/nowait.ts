import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "NOWAIT: fail fast instead of queueing",
  claim:
    "SELECT ... FOR UPDATE NOWAIT refuses to wait: if the row is locked it fails immediately with SQLSTATE 55P03 instead of joining the lock queue.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`BEGIN`;
    await A`SELECT id FROM accounts WHERE id = 1 FOR UPDATE`;

    const err = await B.fails`SELECT id FROM accounts WHERE id = 1 FOR UPDATE NOWAIT`;
    eq(err.code, "55P03"); // lock_not_available — instantly, no waiting

    t.note("Once A is done, the same statement succeeds.");
    await A`COMMIT`;
    const [row] = await B`SELECT id FROM accounts WHERE id = 1 FOR UPDATE NOWAIT`;
    eq(row!.id, 1);
    // #endregion demo
  },
});
