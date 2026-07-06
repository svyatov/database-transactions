import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Lost update at READ COMMITTED",
  claim:
    "Two read-modify-write transactions at READ COMMITTED can silently overwrite each other: two deposits of 10 grow the balance by only 10.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Two app servers process a +10 deposit each: read the balance, add 10 in code, write it back.");
    await A`BEGIN`;
    const [readA] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(readA!.balance, 100);

    await B`BEGIN`;
    const [readB] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(readB!.balance, 100); // B reads the same 100 — A hasn't committed

    await A`UPDATE accounts SET balance = ${readA!.balance + 10} WHERE id = 1`;
    await A`COMMIT`;

    t.note("B computed 100 + 10 from its stale read. Nothing stops the write — A's transaction is long gone.");
    await B`UPDATE accounts SET balance = ${readB!.balance + 10} WHERE id = 1`;
    await B`COMMIT`;

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 110); // two +10 deposits, but only one survived

    t.note("A's deposit vanished without any error. Fixes: atomic UPDATE, SELECT FOR UPDATE, or REPEATABLE READ — see the lesson.");
    // #endregion demo
  },
});
