import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Fixing lost updates #3: optimistic locking with a version column",
  claim:
    "A version column makes the lost update detectable instead of silent: the stale write matches 0 rows (UPDATE 0), and retrying against the new version lands both deposits.",
  setup: `
    CREATE TABLE accounts (
      id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL, version int NOT NULL DEFAULT 1
    );
    INSERT INTO accounts VALUES (1, 'alice', 100, 1);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Both app servers read the row — including its version — with no locks held.");
    await A`BEGIN`;
    const [readA] = await A`SELECT balance, version FROM accounts WHERE id = 1`;
    await B`BEGIN`;
    const [readB] = await B`SELECT balance, version FROM accounts WHERE id = 1`;
    eq(readB!, { balance: 100, version: 1 });

    t.note("Every write bumps the version and only matches the version it read.");
    await A`
      UPDATE accounts SET balance = ${readA!.balance + 10}, version = version + 1
      WHERE id = 1 AND version = ${readA!.version}`;
    await A`COMMIT`;

    const stale = await B`
      UPDATE accounts SET balance = ${readB!.balance + 10}, version = version + 1
      WHERE id = 1 AND version = ${readB!.version}`;
    eq(stale.count, 0); // UPDATE 0 — the row moved on; B's deposit did NOT silently vanish

    t.note("UPDATE 0 is the signal to retry: roll back, re-read, write against the new version.");
    await B`ROLLBACK`;
    await B`BEGIN`;
    const [retry] = await B`SELECT balance, version FROM accounts WHERE id = 1`;
    eq(retry!, { balance: 110, version: 2 });
    await B`
      UPDATE accounts SET balance = ${retry!.balance + 10}, version = version + 1
      WHERE id = 1 AND version = ${retry!.version}`;
    await B`COMMIT`;

    const [final] = await A`SELECT balance, version FROM accounts WHERE id = 1`;
    eq(final!, { balance: 120, version: 3 }); // both deposits survived
    // #endregion
  },
});
