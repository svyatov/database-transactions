import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Fixing lost updates #2: SELECT ... FOR UPDATE",
  claim:
    "When the new value must be computed in application code, SELECT ... FOR UPDATE serializes the read-modify-write: the second reader waits and then reads the committed 110, so both deposits land.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("The app must apply business rules to the balance in code — so it locks the row while it reads.");
    await A`BEGIN`;
    const [a] = await A`SELECT balance FROM accounts WHERE id = 1 FOR UPDATE`;
    eq(a!.balance, 100);

    await B`BEGIN`;
    const pending = await B.blocked`SELECT balance FROM accounts WHERE id = 1 FOR UPDATE`;

    await A`UPDATE accounts SET balance = ${a!.balance + 10} WHERE id = 1`;
    await A`COMMIT`;

    t.note("B's locked read waited out A's transaction — and returns the fresh 110, not the 100 it would have seen.");
    const [b] = await pending.success();
    eq(b!.balance, 110);
    await B`UPDATE accounts SET balance = ${b!.balance + 10} WHERE id = 1`;
    await B`COMMIT`;

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 120); // both deposits survived
    // #endregion
  },
});
