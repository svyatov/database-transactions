import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "REPEATABLE READ turns lost updates into errors",
  claim:
    "The interleaving that silently loses an update at READ COMMITTED fails loudly with SQLSTATE 40001 at REPEATABLE READ — no data is lost, the loser just retries.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("The same two +10 deposits — but this time at REPEATABLE READ.");
    await A`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [readA] = await A`SELECT balance FROM accounts WHERE id = 1`;

    await B`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [readB] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(readB!.balance, 100);

    await A`UPDATE accounts SET balance = ${readA!.balance + 10} WHERE id = 1`;
    await A`COMMIT`;

    t.note("B's snapshot predates A's commit, so B's write is refused instead of silently clobbering it.");
    const err = await B.fails`UPDATE accounts SET balance = ${readB!.balance + 10} WHERE id = 1`;
    eq(err.code, "40001"); // serialization_failure
    await B`ROLLBACK`;

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 110); // A's deposit is safe; B retries and lands on 120

    t.note("Retrying B from scratch reads the fresh 110 and correctly produces 120.");
    // #endregion demo
  },
});
