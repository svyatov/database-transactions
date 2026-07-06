import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "The dual-write problem",
  claim:
    "Two systems, two writes, no shared transaction: whichever write goes first, a failure between them leaves the database and the broker permanently disagreeing.",
  setup: `
    CREATE TABLE orders (id int PRIMARY KEY, customer text NOT NULL, amount int NOT NULL CHECK (amount > 0));
    -- Stand-in for a message broker. In real life this is a SEPARATE system (Kafka,
    -- RabbitMQ, an HTTP call) — you cannot BEGIN a transaction that spans both.
    CREATE TABLE broker (event text NOT NULL);
  `,
  sessions: ["App"],

  async run({ App }, t) {
    // #region demo
    t.note("Attempt 1 — write, then publish. The order commits…");
    await App`BEGIN`;
    await App`INSERT INTO orders VALUES (1, 'alice', 90)`;
    await App`COMMIT`;
    t.note("…and the process crashes before the publish step ever runs. The broker never hears about order 1.");
    const [gap] = await App`
      SELECT (SELECT count(*)::int FROM orders) AS orders,
             (SELECT count(*)::int FROM broker) AS events`;
    eq(gap!, { orders: 1, events: 0 });

    t.note("Attempt 2 — publish first, then write. The event goes out…");
    await App`INSERT INTO broker VALUES ('order_placed: order 2')`;
    t.note("…and then the order INSERT fails — a constraint, a crash, a timeout, anything.");
    const err = await App.fails`INSERT INTO orders VALUES (2, 'mallory', -5)`;
    eq(err.code, "23514"); // check_violation

    t.note("Downstream services now process an order that never existed.");
    const [ghost] = await App`
      SELECT (SELECT count(*)::int FROM orders WHERE id = 2) AS orders,
             (SELECT count(*)::int FROM broker WHERE event LIKE '%order 2%') AS events`;
    eq(ghost!, { orders: 0, events: 1 });
    // #endregion
  },
});
