import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "The transactional outbox",
  claim:
    "Writing the order and its event in one transaction makes them atomic, and a SKIP LOCKED relay gives at-least-once delivery: a crashed relay redelivers the event instead of losing it.",
  setup: `
    CREATE TABLE orders (id int PRIMARY KEY, customer text NOT NULL, amount int NOT NULL);
    CREATE TABLE outbox (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event text NOT NULL);
  `,
  sessions: ["App", "Relay"],

  async run({ App, Relay }, t) {
    // #region demo
    t.note("The order and its event are written in ONE transaction — both land in the same database.");
    await App`BEGIN`;
    await App`INSERT INTO orders VALUES (1, 'alice', 90)`;
    await App`INSERT INTO outbox (event) VALUES ('order_placed: order 1')`;
    await App`COMMIT`;

    t.note("Atomicity covers the failure path too: no committed order, no event.");
    await App`BEGIN`;
    await App`INSERT INTO orders VALUES (2, 'bob', 75)`;
    await App`INSERT INTO outbox (event) VALUES ('order_placed: order 2')`;
    await App`ROLLBACK`;
    const events = await App`SELECT id, event FROM outbox ORDER BY id`;
    eq(events, [{ id: 1, event: "order_placed: order 1" }]);
    // #endregion

    // #region relay
    t.note("A relay claims the event exactly like a chapter-5 job-queue worker…");
    await Relay`BEGIN`;
    const [claimed] = await Relay`
      SELECT id, event FROM outbox ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(claimed!, { id: 1, event: "order_placed: order 1" });

    t.note("…publishes it to the broker (an HTTP call — outside any transaction), deletes it, and crashes before COMMIT.");
    await Relay`DELETE FROM outbox WHERE id = 1`;
    await Relay`ROLLBACK`;

    t.note("The delete evaporated with the crash — the event is still in the outbox. The restarted relay publishes it AGAIN: at-least-once delivery, so consumers must be idempotent.");
    await Relay`BEGIN`;
    const [again] = await Relay`
      SELECT id, event FROM outbox ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    eq(again!, { id: 1, event: "order_placed: order 1" });
    await Relay`DELETE FROM outbox WHERE id = 1`;
    await Relay`COMMIT`;

    const [drained] = await Relay`SELECT count(*)::int AS pending FROM outbox`;
    eq(drained!.pending, 0);
    // #endregion
  },
});
