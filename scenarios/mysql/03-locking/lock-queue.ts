import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Waiters pile up — and sys.innodb_lock_waits shows who blocks whom",
  claim:
    "Sessions waiting for the same row lock pile up behind the holder, visible live in sys.innodb_lock_waits — and every queued update lands once the holder commits.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'shared', 100);
  `,
  sessions: ["A", "B", "C", "M"],

  async run({ A, B, C, M }, t) {
    // #region demo
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = balance + 1 WHERE id = 1`;

    const second = await B.blocked`UPDATE accounts SET balance = balance + 10 WHERE id = 1`;

    t.note("A fourth session, M, can watch the wait live.");
    const waits = await M`SELECT waiting_pid, blocking_pid FROM sys.innodb_lock_waits`;
    eq([...waits], [{ waiting_pid: t.pid("B"), blocking_pid: t.pid("A") }]);

    const third = await C.blocked`UPDATE accounts SET balance = balance + 100 WHERE id = 1`;

    t.note(
      "A commits — the waiters drain. (InnoDB's CATS scheduler does not promise strict FIFO order, but every update lands.)",
    );
    await A`COMMIT`;
    await second.success();
    await third.success();

    const [final] = await C`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 211); // 100 + 1 + 10 + 100 — nothing was lost in the pile-up
    // #endregion
  },
});
