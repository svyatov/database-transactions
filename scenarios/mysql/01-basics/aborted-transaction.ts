import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "An error does NOT abort the transaction",
  claim:
    "After an error inside a transaction, MySQL keeps the transaction alive — only the failed statement is rolled back, and everything else commits normally.",
  setup: `
    CREATE TABLE items (id int PRIMARY KEY, name varchar(50) NOT NULL UNIQUE);
    INSERT INTO items VALUES (1, 'widget');
  `,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    await A`BEGIN`;
    await A`INSERT INTO items VALUES (2, 'gadget')`;

    const err = await A.fails`INSERT INTO items VALUES (3, 'widget')`;
    eq(err.code, "1062"); // ER_DUP_ENTRY

    t.note("PostgreSQL would now refuse every statement until ROLLBACK. MySQL just carries on.");
    await A`INSERT INTO items VALUES (3, 'doohickey')`;
    await A`COMMIT`;

    const rows = await A`SELECT id, name FROM items ORDER BY id`;
    eq(
      [...rows],
      [
        { id: 1, name: "widget" },
        { id: 2, name: "gadget" }, // survived the error in the middle
        { id: 3, name: "doohickey" },
      ],
    );
    // #endregion demo
  },
});
