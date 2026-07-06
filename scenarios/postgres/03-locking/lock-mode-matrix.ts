import { scenario } from "../../../harness/scenario";

export default scenario({
  title: "The four row-lock modes, from friendly to exclusive",
  claim:
    "FOR KEY SHARE < FOR SHARE < FOR NO KEY UPDATE < FOR UPDATE: two share-mode locks coexist, but a share lock still stops writers, and FOR UPDATE stops everything.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Two FOR SHARE locks on the same row coexist happily…");
    await A`BEGIN`;
    await A`SELECT id FROM accounts WHERE id = 1 FOR SHARE`;
    await B`BEGIN`;
    await B`SELECT id FROM accounts WHERE id = 1 FOR SHARE`;
    await B`COMMIT`;

    t.note("…but FOR SHARE still blocks a plain UPDATE (which takes FOR NO KEY UPDATE).");
    const update = await B.blocked`UPDATE accounts SET balance = 200 WHERE id = 1`;
    await A`COMMIT`;
    await update.success();

    t.note("The weakest lock, FOR KEY SHARE, even coexists with a running UPDATE…");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 300 WHERE id = 1`;
    await B`SELECT id FROM accounts WHERE id = 1 FOR KEY SHARE`;

    t.note("…while the strongest, FOR UPDATE, has to wait for it.");
    const forUpdate = await B.blocked`SELECT id FROM accounts WHERE id = 1 FOR UPDATE`;
    await A`COMMIT`;
    await forUpdate.success();
    // #endregion demo
  },
});
