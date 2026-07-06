import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "The idle-in-transaction timeout, from both sides",
  claim:
    "A session that goes idle mid-transaction (the classic ORM failure mode) is killed by idle_in_transaction_session_timeout: its work is rolled back and the app discovers the corpse on its next statement.",
  setup: `
    CREATE TABLE orders (id int PRIMARY KEY, status text NOT NULL);
    INSERT INTO orders VALUES (1, 'pending');
  `,
  sessions: ["A", "M"],

  async run({ A, M }, t) {
    // #region demo
    t.note("An ORM opens a transaction, updates a row… and then the request handler calls a slow external API.");
    await A`SET idle_in_transaction_session_timeout = '500ms'`;
    await A`BEGIN`;
    await A`UPDATE orders SET status = 'paid' WHERE id = 1`;

    t.note("From the outside this is the classic pathology — a session holding locks while doing nothing:");
    const [seen] = await M`SELECT state FROM pg_stat_activity WHERE application_name = 'A'`;
    eq(seen!.state, "idle in transaction");

    t.note("…the API call drags on past the timeout. The server kills the session (FATAL 25P03).");
    await Bun.sleep(1500); // the slow API call

    const corpse = await M`SELECT state FROM pg_stat_activity WHERE application_name = 'A'`;
    eq(corpse.length, 0); // the backend is gone

    t.note("The app finds out only when it finally comes back to commit:");
    const err = await A.fails`COMMIT`;
    eq(err.code, "ERR_POSTGRES_CONNECTION_CLOSED");

    const [order] = await M`SELECT status FROM orders WHERE id = 1`;
    eq(order!.status, "pending"); // the UPDATE was rolled back with the killed session
    // #endregion
  },
});
