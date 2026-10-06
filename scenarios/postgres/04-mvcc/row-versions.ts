import { eq, scenario } from "../../../harness/scenario";

export default scenario({
  title: "Row versions: xmin, xmax, ctid",
  claim:
    "In this setup UPDATE creates a new tuple at (0,2), while B's old Repeatable Read snapshot still reads the original balance at (0,1). After DELETE there are zero live rows but both tuple versions remain in the inspected page. This is not a promise of permanent physical retention.",
  setup: `
    CREATE EXTENSION pageinspect;
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note(
      "Inspect this tuple version: xmin identifies its inserting transaction, ctid its physical location. xmax can record deletion or row locking; this schedule follows the update/delete case.",
    );
    const [v1] = await A`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq([v1!.xmax, v1!.ctid, v1!.balance], [0, "(0,1)", 100]);

    await B`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [b1] = await B`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq([b1!.xmin, b1!.xmax, b1!.ctid, b1!.balance], [v1!.xmin, 0, "(0,1)", 100]);

    t.note("A's UPDATE creates a new tuple version and changes the old version's xmax and successor pointer.");
    const [v2] = await A`
      UPDATE accounts SET balance = 200 WHERE id = 1
      RETURNING xmin, xmax, ctid, balance`;
    eq([v2!.ctid, v2!.balance], ["(0,2)", 200]);

    t.note("B still reads the old version — but its xmax is no longer 0: A's xid is stamped on it.");
    const [b2] = await B`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq(b2!.balance, 100);
    eq(b2!.xmax, v2!.xmin, "the old version's xmax IS the updater's xid");
    await B`COMMIT`;

    const [b3] = await B`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq([b3!.xmin, b3!.ctid, b3!.balance], [v2!.xmin, "(0,2)", 200], "a fresh snapshot sees the new version");

    t.note("pageinspect shows both versions physically on page 0 — the old one points at its successor.");
    const heap = await A`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('accounts', 0)) ORDER BY lp`;
    eq(heap, [
      { lp: 1, t_xmin: v1!.xmin, t_xmax: v2!.xmin, t_ctid: "(0,2)" },
      { lp: 2, t_xmin: v2!.xmin, t_xmax: 0, t_ctid: "(0,2)" },
    ]);
    // #endregion demo

    // #region delete
    t.note(
      "DELETE marks the current version deleted; the following page inspection checks that its tuple body remains here.",
    );
    const [d] = await A`DELETE FROM accounts WHERE id = 1 RETURNING xmin, xmax, ctid`;
    eq(d!.xmin, v2!.xmin);
    eq(d!.xmax > 0, true, "the deleter's xid, stamped at delete time");

    const [live] = await A`SELECT count(*)::int AS live_rows FROM accounts`;
    eq(live!.live_rows, 0);

    t.note("Zero rows for SELECT — yet both versions are still on disk, awaiting VACUUM.");
    const afterDelete = await A`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('accounts', 0)) ORDER BY lp`;
    eq(afterDelete, [
      { lp: 1, t_xmin: v1!.xmin, t_xmax: v2!.xmin, t_ctid: "(0,2)" },
      { lp: 2, t_xmin: v2!.xmin, t_xmax: d!.xmax, t_ctid: "(0,2)" },
    ]);
    // #endregion delete
  },
});
