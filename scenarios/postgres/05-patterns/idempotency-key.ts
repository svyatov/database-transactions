import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Idempotency keys: charging once, no matter how many retries",
  claim:
    "INSERT ... ON CONFLICT DO NOTHING RETURNING on an idempotency key makes retries safe: the first request charges, every retry — even one racing the original in flight — gets 0 rows back and charges nothing.",
  setup: `
    CREATE TABLE payments (idempotency_key text PRIMARY KEY, amount int NOT NULL);
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("The client sends 'charge $30' with idempotency key req-42. Server A processes it.");
    await A`BEGIN`;
    const claimed = await A`
      INSERT INTO payments VALUES ('req-42', 30)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key`;
    eq(claimed.length, 1); // a row came back: this key is new — do the work
    await A`UPDATE accounts SET balance = balance - 30 WHERE id = 1`;
    await A`COMMIT`;

    t.note("The response is lost in the network. The client retries the same request; server B picks it up.");
    await B`BEGIN`;
    const replay = await B`
      INSERT INTO payments VALUES ('req-42', 30)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key`;
    eq(replay.length, 0); // 0 rows: already processed — skip the charge, return the stored result
    const [stored] = await B`SELECT amount FROM payments WHERE idempotency_key = 'req-42'`;
    eq(stored!.amount, 30);
    await B`COMMIT`;

    const [once] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(once!.balance, 70); // charged exactly once
    // #endregion demo

    // #region race
    t.note("The nasty case: the retry arrives while the original is still in flight, uncommitted.");
    await A`BEGIN`;
    await A`
      INSERT INTO payments VALUES ('req-99', 25)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key`;
    await A`UPDATE accounts SET balance = balance - 25 WHERE id = 1`;

    const pending = await B.blocked`
      INSERT INTO payments VALUES ('req-99', 25)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key`;

    t.note("The unique index parks the retry until the original decides. A commits — the retry absorbs to 0 rows.");
    await A`COMMIT`;
    const raced = await pending.success();
    eq(raced.length, 0); // even the in-flight duplicate cannot double-charge

    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 45); // 100 - 30 - 25: every charge applied exactly once
    // #endregion race
  },
});
