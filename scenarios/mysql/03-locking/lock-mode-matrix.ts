import { scenario } from "../../../harness/scenario";

export default scenario({
  title: "Two row-lock strengths: shared and exclusive",
  claim:
    "InnoDB row locks come in exactly two strengths — S locks coexist with each other but block writers, X locks block everything. There is no PostgreSQL-style four-mode ladder.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
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

    t.note("…but a FOR SHARE still blocks a plain UPDATE (which needs an X lock).");
    const update = await B.blocked`UPDATE accounts SET balance = 200 WHERE id = 1`;
    await A`COMMIT`;
    await update.success();

    t.note("And an X lock blocks even the friendliest reader: FOR SHARE has to wait for a running UPDATE.");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 300 WHERE id = 1`;
    const share = await B.blocked`SELECT id FROM accounts WHERE id = 1 FOR SHARE`;
    await A`COMMIT`;
    await share.success();

    t.note("PostgreSQL's FOR KEY SHARE would coexist with that UPDATE — InnoDB has no lock that weak.");
    // #endregion
  },
});
