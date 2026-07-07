import { scenario, eq } from "../../../harness/scenario";

// #region helper
/** Re-run `fn` when it fails with a transient InnoDB error: 1213 (deadlock victim). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.code !== "1213" || attempt === attempts) throw e;
    }
  }
}
// #endregion helper

export default scenario({
  title: "Retrying deadlocks",
  claim:
    "Errno 1213 is transient, not fatal: the victim's transaction rerun from the top sees the survivor's committed state and succeeds — withRetry needs exactly two attempts here.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    let attempt = 0;
    await withRetry(async () => {
      attempt++;
      await B`BEGIN`;
      await B`UPDATE accounts SET balance = balance - 25 WHERE id = 2`;

      if (attempt === 1) {
        // Force the deadlock once: A runs the opposite transfer, locking in reverse order.
        t.note("B holds bob. A locks alice, then wants bob — and blocks. B then wants alice: a cycle.");
        await A`BEGIN`;
        await A`UPDATE accounts SET balance = balance - 10 WHERE id = 1`;
        const pending = await A.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 2`;
        const err = await B.fails`UPDATE accounts SET balance = balance + 25 WHERE id = 1`;
        eq(err.code, "1213");
        await pending.success(); // B's rollback freed bob — A's transfer completes
        await A`COMMIT`;
        throw err; // hand the 1213 to withRetry, exactly as a driver would
      }

      t.note("Attempt 2 is a brand-new transaction. A is done — B's transfer sails through.");
      await B`UPDATE accounts SET balance = balance + 25 WHERE id = 1`;
      await B`COMMIT`;
    });
    eq(attempt, 2);

    const [alice] = await A`SELECT balance FROM accounts WHERE id = 1`;
    const [bob] = await A`SELECT balance FROM accounts WHERE id = 2`;
    eq(alice!.balance, 115); // 100 - 10 (A) + 25 (B)
    eq(bob!.balance, 85); //   100 + 10 (A) - 25 (B)
    // #endregion demo
  },
});
