import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Current reads punch holes in the snapshot",
  claim:
    "A REPEATABLE READ transaction's UPDATE operates on the CURRENT committed row, not on its snapshot — and afterwards the transaction sees its own write, so the 'repeatable' read changes.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region committed
    await A`BEGIN`;
    const [snap] = await A`SELECT balance FROM accounts WHERE id = 1`; // snapshot taken
    eq(snap!.balance, 100);

    t.note("B commits a change. A keeps READING its stale snapshot…");
    await B`UPDATE accounts SET balance = 150 WHERE id = 1`;

    const [stale] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(stale!.balance, 100);

    t.note("…but A's UPDATE is a current read: it computes from B's committed 150, not from the snapshot's 100.");
    await A`UPDATE accounts SET balance = balance + 50 WHERE id = 1`;

    const [after] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(after!.balance, 200); // 150 + 50 — and now A sees it: the snapshot has a hole

    await A`COMMIT`;
    t.note("PostgreSQL would have aborted A's UPDATE with 40001 instead. MySQL quietly switches world views.");
    // #endregion

    // #region uncommitted
    t.note("If the competing write is NOT yet committed, A first waits on the row lock…");
    await A`BEGIN`;
    await A`SELECT balance FROM accounts WHERE id = 1`; // snapshot taken

    await B`BEGIN`;
    await B`UPDATE accounts SET balance = 300 WHERE id = 1`;

    const pending = await A.blocked`UPDATE accounts SET balance = balance + 50 WHERE id = 1`;

    t.note("…and proceeds from B's value the moment B commits. No error here either.");
    await B`COMMIT`;

    await pending.success();
    const [final] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 350); // 300 + 50
    await A`COMMIT`;
    // #endregion
  },
});
