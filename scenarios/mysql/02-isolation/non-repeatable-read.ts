import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Non-repeatable read under READ COMMITTED",
  claim:
    "At READ COMMITTED, a transaction can read two different values for the same row — other transactions' commits become visible between its statements.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
    await A`BEGIN`;
    const [first] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(first!.balance, 100);

    t.note("While A's transaction is still open, B updates the row and commits.");
    await B`UPDATE accounts SET balance = 200 WHERE id = 1`;

    const [second] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(second!.balance, 200); // same query, same transaction — different answer
    await A`COMMIT`;
    // #endregion demo

    // #region blocking
    t.note(
      "Readers never block — but writers do. The same interleaving with UPDATEs makes B wait for A's row lock.",
    );
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 300 WHERE id = 1`;

    const pending = await B.blocked`UPDATE accounts SET balance = 400 WHERE id = 1`;

    await A`COMMIT`; // releases the row lock
    await pending.success(); // only now does B's UPDATE finish

    const [final] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 400); // B's write landed on top of A's committed 300
    // #endregion blocking
  },
});
