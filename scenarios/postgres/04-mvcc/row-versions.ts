import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Row versions: xmin, xmax, ctid",
  claim:
    "UPDATE never modifies a row in place — it writes a new version stamped with its xid (xmin) and stamps the old one's xmax; DELETE only stamps xmax. Both versions stay on disk, visible with pageinspect.",
  setup: `
    CREATE EXTENSION pageinspect;
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note(
      "Every row carries hidden system columns: xmin = the transaction that created this version, xmax = the one that deleted or replaced it (0 = nobody yet), ctid = its physical address (page, slot).",
    );
    const [v1] = await A`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq([v1!.xmax, v1!.ctid, v1!.balance], [0, "(0,1)", 100]);

    await B`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [b1] = await B`SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1`;
    eq(b1!.xmin, v1!.xmin);

    t.note("A's UPDATE doesn't touch that version — it writes a brand-new one at a new ctid.");
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
    eq(b3!.xmin, v2!.xmin, "a fresh snapshot sees the new version");

    t.note("pageinspect shows both versions physically on page 0 — the old one points at its successor.");
    const heap = await A`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('accounts', 0)) ORDER BY lp`;
    eq(heap, [
      { lp: 1, t_xmin: v1!.xmin, t_xmax: v2!.xmin, t_ctid: "(0,2)" },
      { lp: 2, t_xmin: v2!.xmin, t_xmax: 0, t_ctid: "(0,2)" },
    ]);
    // #endregion

    // #region delete
    t.note("DELETE doesn't erase anything either — it only stamps xmax on the current version.");
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
    // #endregion
  },
});
