import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Long transactions block VACUUM",
  claim:
    "VACUUM can only remove tuples no snapshot can still see — one long-running transaction holds the horizon back for every table, and VACUUM silently reclaims nothing until it ends.",
  setup: `
    CREATE EXTENSION pageinspect;
    CREATE TABLE jobs (id int PRIMARY KEY, status text NOT NULL);
    INSERT INTO jobs VALUES (1, 'new');
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("A opens a long report transaction — one query, then it just sits there.");
    await A`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [j0] = await A`SELECT xmin, id, status FROM jobs`;

    t.note("Meanwhile B churns through the row, leaving dead versions behind.");
    const [j1] = await B`UPDATE jobs SET status = 'running' WHERE id = 1 RETURNING xmin, status`;
    const [j2] = await B`UPDATE jobs SET status = 'done' WHERE id = 1 RETURNING xmin, status`;
    const [j3] = await B`UPDATE jobs SET status = 'archived' WHERE id = 1 RETURNING xmin, status`;

    const chain = [
      { lp: 1, t_xmin: j0!.xmin, t_xmax: j1!.xmin, t_ctid: "(0,2)" },
      { lp: 2, t_xmin: j1!.xmin, t_xmax: j2!.xmin, t_ctid: "(0,3)" },
      { lp: 3, t_xmin: j2!.xmin, t_xmax: j3!.xmin, t_ctid: "(0,4)" },
      { lp: 4, t_xmin: j3!.xmin, t_xmax: 0, t_ctid: "(0,4)" },
    ];
    const before = await B`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('jobs', 0)) ORDER BY lp`;
    eq(before, chain);

    await B`VACUUM jobs`;
    t.note("VACUUM ran, reported success — and removed nothing. A's snapshot might still need every one of those versions.");
    const after = await B`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('jobs', 0)) ORDER BY lp`;
    eq(after, chain, "the heap page is byte-for-byte the same");

    t.note("And indeed: A still reads the version from before all three updates.");
    const [stillNew] = await A`SELECT id, status FROM jobs`;
    eq(stillNew!.status, "new");
    await A`COMMIT`;

    await B`VACUUM jobs`;
    t.note("Same command, a moment after A commits — now the three dead versions are gone.");
    const cleaned = await B`
      SELECT lp, lp_flags, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('jobs', 0)) ORDER BY lp`;
    eq(cleaned, [
      { lp: 1, lp_flags: 2, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 2, lp_flags: 0, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 3, lp_flags: 0, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 4, lp_flags: 1, t_xmin: j3!.xmin, t_xmax: 0, t_ctid: "(0,4)" },
    ]);
    // #endregion
  },
});
