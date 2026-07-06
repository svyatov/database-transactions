import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "REPEATABLE READ: one snapshot for the whole transaction",
  claim:
    "At REPEATABLE READ — MySQL's default — plain SELECTs use a single snapshot for the entire transaction: no non-repeatable reads and no phantoms.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 50);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`BEGIN`;

    t.note("The snapshot is taken by the FIRST query, not by BEGIN.");
    const first = await A`SELECT id, balance FROM accounts ORDER BY id`;
    eq(first.length, 2);

    t.note("B changes an existing row AND inserts a new one — both committed instantly.");
    await B`UPDATE accounts SET balance = 999 WHERE id = 1`;
    await B`INSERT INTO accounts VALUES (3, 'carol', 300)`;

    const again = await A`SELECT id, balance FROM accounts ORDER BY id`;
    eq(
      [...again],
      [
        { id: 1, balance: 100 }, // not 999 — no non-repeatable read
        { id: 2, balance: 50 }, // and no carol — no phantom
      ],
    );

    await A`COMMIT`;

    t.note("Only a NEW transaction gets a new snapshot.");
    const after = await A`SELECT id, balance FROM accounts ORDER BY id`;
    eq(after.length, 3);
    eq(after[0]!.balance, 999);
    // #endregion
  },
});
