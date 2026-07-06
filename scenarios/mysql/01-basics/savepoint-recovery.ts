import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Savepoints: discard a risky branch mid-transaction",
  claim:
    "ROLLBACK TO SAVEPOINT discards only the work done after the savepoint — the rest of the transaction commits normally.",
  setup: `
    CREATE TABLE items (id int PRIMARY KEY, name varchar(50) NOT NULL UNIQUE);
    INSERT INTO items VALUES (1, 'widget');
  `,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    await A`BEGIN`;
    await A`INSERT INTO items VALUES (2, 'gadget')`;
    await A`SAVEPOINT before_risky`;

    t.note("The risky branch makes real progress before it fails…");
    await A`INSERT INTO items VALUES (3, 'gizmo')`;
    const err = await A.fails`INSERT INTO items VALUES (4, 'widget')`;
    eq(err.code, "1062"); // ER_DUP_ENTRY

    t.note("The transaction is still alive — but the branch is half-done. Rewind all of it in one go.");
    await A`ROLLBACK TO SAVEPOINT before_risky`;
    await A`INSERT INTO items VALUES (3, 'doohickey')`;
    await A`COMMIT`;

    const rows = await A`SELECT id, name FROM items ORDER BY id`;
    eq(
      [...rows],
      [
        { id: 1, name: "widget" },
        { id: 2, name: "gadget" }, // survived — it predates the savepoint
        { id: 3, name: "doohickey" }, // 'gizmo' is gone with the branch
      ],
    );
    // #endregion demo
  },
});
