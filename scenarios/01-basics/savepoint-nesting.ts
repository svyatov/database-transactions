import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Nested savepoints and RELEASE",
  claim:
    "Rolling back to an outer savepoint discards inner savepoints along with their work; RELEASE keeps the changes but forfeits the rollback point.",
  setup: `CREATE TABLE steps (n int PRIMARY KEY);`,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    await A`BEGIN`;
    await A`INSERT INTO steps VALUES (1)`;
    await A`SAVEPOINT outer_sp`;
    await A`INSERT INTO steps VALUES (2)`;
    await A`SAVEPOINT inner_sp`;
    await A`INSERT INTO steps VALUES (3)`;

    t.note("Rolling back to the OUTER savepoint discards rows 2 and 3 — and inner_sp itself.");
    await A`ROLLBACK TO SAVEPOINT outer_sp`;

    const gone = await A.fails`ROLLBACK TO SAVEPOINT inner_sp`;
    eq(gone.code, "3B001"); // no such savepoint — it was destroyed by the outer rollback

    await A`ROLLBACK TO SAVEPOINT outer_sp`; // recover from that error, same trick as before

    t.note("RELEASE keeps the work done after the savepoint, but you can no longer rewind to it.");
    await A`INSERT INTO steps VALUES (4)`;
    await A`RELEASE SAVEPOINT outer_sp`;
    await A`COMMIT`;

    const rows = await A`SELECT n FROM steps ORDER BY n`;
    eq([...rows], [{ n: 1 }, { n: 4 }]);
    // #endregion
  },
});
