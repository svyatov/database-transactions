import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Autocommit and visibility",
  claim:
    "Without BEGIN, every statement commits instantly and is immediately visible to everyone; inside BEGIN, changes stay private until COMMIT.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("No BEGIN — the UPDATE is its own transaction, committed the instant it finishes.");
    await A`UPDATE accounts SET balance = 150 WHERE id = 1`;

    const [seen] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(seen!.balance, 150); // B sees it immediately

    t.note("Inside an explicit transaction, A's change is invisible to B…");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 999 WHERE id = 1`;

    const [hidden] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(hidden!.balance, 150); // still the old value

    t.note("…until A commits.");
    await A`COMMIT`;

    const [visible] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(visible!.balance, 999);
    // #endregion
  },
});
