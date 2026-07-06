import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "READ COMMITTED re-checks WHERE after waiting",
  claim:
    "An UPDATE at READ COMMITTED that waited for a lock re-evaluates its WHERE clause against the new row version — rows that no longer match are silently skipped.",
  setup: `
    CREATE TABLE items (id int PRIMARY KEY, value int NOT NULL);
    INSERT INTO items VALUES (1, 10), (2, 30);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    await A`BEGIN`;
    await A`UPDATE items SET value = value * 2 WHERE id = 1`; // row 1: 10 → 20, uncommitted

    t.note(
      "B targets WHERE value = 10. The latest committed version of row 1 still qualifies — but it's locked by A, so B waits.",
    );
    await B`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
    await B`BEGIN`;
    const pending = await B.blocked`UPDATE items SET value = 99 WHERE value = 10`;

    t.note(
      "A commits. B wakes up and re-checks the row it waited for — against the NEW version, where value is 20.",
    );
    await A`COMMIT`;

    const result = await pending.success();
    eq(result.affectedRows, 0); // 0 rows affected — the row slipped away
    await B`COMMIT`;

    const rows = await B`SELECT id, value FROM items ORDER BY id`;
    eq(
      [...rows],
      [
        { id: 1, value: 20 },
        { id: 2, value: 30 },
      ],
    );
    // #endregion demo
  },
});
