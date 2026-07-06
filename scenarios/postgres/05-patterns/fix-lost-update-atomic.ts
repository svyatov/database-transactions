import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Fixing lost updates #1: compute in SQL, not in the app",
  claim:
    "UPDATE ... SET balance = balance + 10 reads and writes in one statement: the second writer waits for the first and stacks on top — both deposits survive.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Same two +10 deposits that lost an update in chapter 2 — but the math moved into the UPDATE itself.");
    await A`BEGIN`;
    const [a] = await A`UPDATE accounts SET balance = balance + 10 WHERE id = 1 RETURNING balance`;
    eq(a!.balance, 110);

    await B`BEGIN`;
    const pending = await B.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 1 RETURNING balance`;

    t.note("No stale read exists to write back: B waits for A's row lock, then re-reads the committed 110.");
    await A`COMMIT`;
    const [b] = await pending.success();
    eq(b!.balance, 120);
    await B`COMMIT`;

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 120); // both deposits survived
    // #endregion
  },
});
