import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "READ UNCOMMITTED really reads uncommitted data",
  claim:
    "At READ UNCOMMITTED, MySQL serves other transactions' uncommitted changes — including values that are later rolled back and thus never existed.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 999 WHERE id = 1`;

    t.note("B opts into READ UNCOMMITTED — and sees A's uncommitted 999.");
    await B`SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`;
    await B`BEGIN`;

    const [level] = await B`SELECT @@transaction_isolation AS isolation`;
    eq(level!.isolation, "READ-UNCOMMITTED");

    const [dirty] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(dirty!.balance, 999); // a dirty read — A never committed this

    t.note("A rolls back. The 999 B just read never existed.");
    await A`ROLLBACK`;

    const [after] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(after!.balance, 100);
    await B`COMMIT`;
    // #endregion
  },
});
