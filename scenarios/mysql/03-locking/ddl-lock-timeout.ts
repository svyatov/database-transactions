import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "The fix: run DDL with a lock_wait_timeout",
  claim:
    "With lock_wait_timeout set, a migration that can't get its metadata lock fails fast (errno 1205) instead of queueing — and other sessions' queries are never blocked behind it.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B", "C"],

  async run({ A, B, C }, t) {
    // #region demo
    await A`BEGIN`;
    await A`SELECT balance FROM accounts WHERE id = 1`; // the same long transaction as before

    t.note("Same migration — but this time it gives up after a second instead of camping in the queue.");
    await B`SET SESSION lock_wait_timeout = 1`;
    const err = await B.fails`ALTER TABLE accounts ADD COLUMN note varchar(50)`;
    eq(err.code, "1205"); // ER_LOCK_WAIT_TIMEOUT

    t.note("No waiting ALTER in the queue means no outage: C's read is instant.");
    const [row] = await C`SELECT balance FROM accounts WHERE id = 1`;
    eq(row!.balance, 100);

    await A`COMMIT`;
    t.note("Retry the migration when it can actually get the lock — now it sails through.");
    await B`ALTER TABLE accounts ADD COLUMN note varchar(50)`;
    // #endregion
  },
});
