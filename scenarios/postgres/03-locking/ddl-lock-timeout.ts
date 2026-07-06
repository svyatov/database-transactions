import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "The fix: run DDL with a lock_timeout",
  claim:
    "With lock_timeout set, a migration that can't get its lock fails fast (55P03) instead of queueing — and other sessions' queries are never blocked behind it.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B", "C"],

  async run({ A, B, C }, t) {
    // #region demo
    await A`BEGIN`;
    await A`SELECT balance FROM accounts WHERE id = 1`; // the same long transaction as before

    t.note("Same migration — but this time it gives up after 100ms instead of camping in the queue.");
    await B`SET lock_timeout = '100ms'`;
    const err = await B.fails`ALTER TABLE accounts ADD COLUMN note text`;
    eq(err.code, "55P03");

    t.note("No waiting ALTER in the queue means no outage: C's read is instant.");
    const [row] = await C`SELECT balance FROM accounts WHERE id = 1`;
    eq(row!.balance, 100);

    await A`COMMIT`;
    t.note("Retry the migration when it can actually get the lock — now it sails through.");
    await B`ALTER TABLE accounts ADD COLUMN note text`;
    // #endregion demo
  },
});
