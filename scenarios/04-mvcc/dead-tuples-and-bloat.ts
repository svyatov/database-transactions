import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "Dead tuples and bloat",
  claim:
    "Every UPDATE leaves a dead tuple behind and every DELETE leaves the row on disk — so a table's file only ever grows, no matter how much data you delete.",
  setup: `
    CREATE EXTENSION pageinspect;
    CREATE TABLE counters (id int PRIMARY KEY, n int NOT NULL);
    CREATE TABLE bloat (id int PRIMARY KEY, filler text NOT NULL);
  `,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    const [x0] = await A`INSERT INTO counters VALUES (1, 0) RETURNING xmin, n`;
    t.note("Three updates to one row. Watch each one get a fresh xid — and leave a corpse.");
    const [x1] = await A`UPDATE counters SET n = 1 WHERE id = 1 RETURNING xmin, n`;
    const [x2] = await A`UPDATE counters SET n = 2 WHERE id = 1 RETURNING xmin, n`;
    const [x3] = await A`UPDATE counters SET n = 3 WHERE id = 1 RETURNING xmin, n`;

    t.note("SELECT sees one row. The page holds four tuples — a version chain, three of them dead.");
    await A`SELECT n FROM counters`;
    const heap = await A`
      SELECT lp, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('counters', 0)) ORDER BY lp`;
    eq(heap, [
      { lp: 1, t_xmin: x0!.xmin, t_xmax: x1!.xmin, t_ctid: "(0,2)" },
      { lp: 2, t_xmin: x1!.xmin, t_xmax: x2!.xmin, t_ctid: "(0,3)" },
      { lp: 3, t_xmin: x2!.xmin, t_xmax: x3!.xmin, t_ctid: "(0,4)" },
      { lp: 4, t_xmin: x3!.xmin, t_xmax: 0, t_ctid: "(0,4)" },
    ]);
    // #endregion

    // #region size
    t.note("The same effect at scale: 1000 rows fit in 5 pages of 8 kB.");
    await A`INSERT INTO bloat SELECT g, 'x' FROM generate_series(1, 1000) g`;
    const [s1] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s1!.pages, 5);

    t.note("One UPDATE of every row = a full second copy of the table.");
    await A`UPDATE bloat SET filler = 'y'`;
    const [s2] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s2!.pages, 9);

    t.note("Now delete everything. Zero rows — and not a single byte returned.");
    await A`DELETE FROM bloat`;
    const [gone] = await A`SELECT count(*)::int AS live_rows FROM bloat`;
    eq(gone!.live_rows, 0);
    const [s3] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s3!.pages, 9);
    // #endregion
  },
});
