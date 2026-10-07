import { eq, scenario } from "../../../harness/scenario";

// #region helper
/** Re-run `fn` when it fails with a serialization failure (SQLSTATE 40001). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.code !== "40001" || attempt === attempts) throw e;
    }
  }
}
// #endregion helper

export default scenario({
  title: "Retrying serialization failures",
  claim:
    "In this forced REPEATABLE READ conflict, B rolls back after 40001 and retries with fresh reads: two attempts produce balance 115. Eventual success is not guaranteed.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    let attempt = 0;
    await withRetry(async () => {
      attempt++;
      await B`BEGIN ISOLATION LEVEL REPEATABLE READ`;
      const [row] = await B`SELECT balance FROM accounts WHERE id = 1`;

      if (attempt === 1) {
        // Force the conflict once: A commits a deposit between B's read and B's write.
        t.note("B read 100. Before it writes, A commits a conflicting deposit — B's write is now doomed.");
        await A`UPDATE accounts SET balance = balance + 10 WHERE id = 1`;
        const err = await B.fails`UPDATE accounts SET balance = ${row!.balance + 5} WHERE id = 1`;
        eq(err.code, "40001");
        await B`ROLLBACK`;
        throw err; // hand the 40001 to withRetry, exactly as a driver would
      }

      t.note("Attempt 2 is a brand-new transaction: it reads 110 — the state that made attempt 1 impossible.");
      await B`UPDATE accounts SET balance = ${row!.balance + 5} WHERE id = 1`;
      await B`COMMIT`;
    });
    eq(attempt, 2);

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 115); // A's +10 and B's +5 both applied
    // #endregion demo
  },
});
