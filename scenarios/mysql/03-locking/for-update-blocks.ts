import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "SELECT FOR UPDATE blocks writers, never readers",
  claim:
    "A row locked with SELECT FOR UPDATE can still be read by everyone, but any write to it waits until the locking transaction ends.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`BEGIN`;
    await A`SELECT * FROM accounts WHERE id = 1 FOR UPDATE`;

    t.note("Reading the locked row costs B nothing — MVCC readers don't take row locks.");
    const [read] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(read!.balance, 100);

    t.note("Writing to it is another story: B's UPDATE must wait for A.");
    const pending = await B.blocked`UPDATE accounts SET balance = balance - 10 WHERE id = 1`;

    await A`UPDATE accounts SET balance = 150 WHERE id = 1`;
    await A`COMMIT`; // releases the row lock

    await pending.success();
    const [after] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(after!.balance, 140); // B's -10 applied on top of A's committed 150
    // #endregion
  },
});
