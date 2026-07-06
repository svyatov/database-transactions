import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Deadlock: two transactions, opposite lock order",
  claim:
    "Two transactions locking the same rows in opposite order deadlock; InnoDB detects the cycle instantly and rolls back one of them with errno 1213 so the other can finish.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("A transfers 10 from alice to bob; B transfers 25 from bob to alice.");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = balance - 10 WHERE id = 1`; // A locks alice

    await B`BEGIN`;
    await B`UPDATE accounts SET balance = balance - 25 WHERE id = 2`; // B locks bob

    t.note("A now needs bob's row (B has it) — it waits.");
    const pending = await A.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 2`;

    t.note("B now needs alice's row (A has it). A waits for B, B waits for A: a cycle.");
    const err = await B.fails`UPDATE accounts SET balance = balance + 25 WHERE id = 1`;
    eq(err.code, "1213"); // ER_LOCK_DEADLOCK — B's whole transaction is rolled back…

    await pending.success(); // …which frees bob's row, so A's stuck UPDATE completes
    await A`COMMIT`;

    const rows = await A`SELECT owner, balance FROM accounts ORDER BY id`;
    eq([...rows], [
      { owner: "alice", balance: 90 },
      { owner: "bob", balance: 110 },
    ]); // A's transfer survived; B's evaporated — retry it

    t.note(
      "Note: unlike a lock timeout, a deadlock rolls back B's ENTIRE transaction — there is nothing left to ROLLBACK.",
    );
    // #endregion demo
  },
});
