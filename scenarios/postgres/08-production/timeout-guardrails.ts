import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Timeout guardrails",
  claim:
    "statement_timeout cancels a runaway statement (SQLSTATE 57014) but keeps the session; transaction_timeout kills the whole transaction — connection and all — and its work rolls back.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "M"],

  async run({ A, M }, t) {
    // #region statement
    t.note("statement_timeout: the per-statement seatbelt.");
    await A`SET statement_timeout = '100ms'`;
    const canceled = await A.fails`SELECT pg_sleep(2)`;
    eq(canceled.code, "57014"); // query_canceled

    t.note("Only the statement died — the session and its transaction state are fine.");
    const [alive] = await A`SELECT 'still here' AS session`;
    eq(alive!.session, "still here");
    // #endregion statement

    // #region transaction
    t.note("transaction_timeout (PostgreSQL 17+): a hard ceiling on the whole transaction — idle or busy.");
    await A`RESET statement_timeout`;
    await A`SET transaction_timeout = '500ms'`;
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 999 WHERE id = 1`;
    // #endregion transaction

    await Bun.sleep(1200); // let the timeout fire (invisible: the point is what M sees next)

    // #region aftermath
    t.note("This timeout doesn't cancel a statement — it terminates the backend:");
    const [gone] = await M`
      SELECT count(*)::int AS backends FROM pg_stat_activity WHERE application_name = 'A'`;
    eq(gone!.backends, 0);

    const dead = await A.fails`COMMIT`;
    eq(dead.code, "ERR_POSTGRES_CONNECTION_CLOSED"); // the server logged FATAL; Bun sees a dead socket

    t.note("The killed transaction's work rolled back, as always:");
    const [balance] = await M`SELECT balance FROM accounts WHERE id = 1`;
    eq(balance!.balance, 100);
    // #endregion aftermath
  },
});
