import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Atomicity: all or nothing",
  claim:
    "A transaction that fails halfway leaves zero partial writes — even statements that already succeeded inside it are undone.",
  setup: `
    CREATE TABLE accounts (
      id      int PRIMARY KEY,
      owner   varchar(20) NOT NULL,
      balance int NOT NULL CHECK (balance >= 0)
    );
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 50);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("A transfers 150 from alice to bob. Crediting bob works fine…");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = balance + 150 WHERE owner = 'bob'`;

    const [bob] = await B`SELECT balance FROM accounts WHERE owner = 'bob'`;
    eq(bob!.balance, 50); // B can't see A's uncommitted credit

    t.note("…but debiting alice violates the CHECK constraint — she only has 100.");
    const err = await A.fails`UPDATE accounts SET balance = balance - 150 WHERE owner = 'alice'`;
    eq(err.code, "3819"); // ER_CHECK_CONSTRAINT_VIOLATED

    t.note("Roll the transaction back. Bob's credit — which had succeeded — evaporates with it.");
    await A`ROLLBACK`;

    const rows = await B`SELECT owner, balance FROM accounts ORDER BY id`;
    eq(
      [...rows],
      [
        { owner: "alice", balance: 100 },
        { owner: "bob", balance: 50 },
      ],
    );
    // #endregion demo
  },
});
