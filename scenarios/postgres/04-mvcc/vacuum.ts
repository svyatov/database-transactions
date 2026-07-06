import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "VACUUM: reclaim for reuse, not for the OS",
  claim:
    "VACUUM turns dead tuples into reusable free space inside the table's file — new rows land in the freed slots — but it does not shrink the file; only VACUUM FULL rewrites the table to its minimal size.",
  setup: `
    CREATE EXTENSION pageinspect;
    CREATE TABLE counters (id int PRIMARY KEY, n int NOT NULL);
    INSERT INTO counters VALUES (1, 0);
    CREATE TABLE bloat (id int PRIMARY KEY, filler text NOT NULL);
    INSERT INTO bloat SELECT g, 'x' FROM generate_series(1, 1000) g;
  `,
  sessions: ["A"],

  async run({ A }, t) {
    // #region demo
    t.note("Three updates leave three dead tuples on the page (the bloat lesson showed the chain).");
    await A`UPDATE counters SET n = 1 WHERE id = 1`;
    await A`UPDATE counters SET n = 2 WHERE id = 1`;
    const [last] = await A`UPDATE counters SET n = 3 WHERE id = 1 RETURNING xmin, n`;

    await A`VACUUM counters`;
    t.note("After VACUUM: slot 1 is a redirect to the live version, slots 2–3 are unused (reusable), only slot 4 still holds a tuple. The corpses are gone.");
    const heap = await A`
      SELECT lp, lp_flags, t_xmin, t_xmax, t_ctid
      FROM heap_page_items(get_raw_page('counters', 0)) ORDER BY lp`;
    eq(heap, [
      { lp: 1, lp_flags: 2, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 2, lp_flags: 0, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 3, lp_flags: 0, t_xmin: null, t_xmax: null, t_ctid: null },
      { lp: 4, lp_flags: 1, t_xmin: last!.xmin, t_xmax: 0, t_ctid: "(0,4)" },
    ]);

    t.note("The freed space is immediately reusable: the next INSERT lands in slot 2.");
    const [reused] = await A`INSERT INTO counters VALUES (2, 0) RETURNING ctid, id`;
    eq(reused!.ctid, "(0,2)");
    // #endregion

    // #region size
    t.note("Same story at file level: 1000 rows in 5 pages, doubled to 9 by an UPDATE of every row.");
    const [s1] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s1!.pages, 5);
    await A`UPDATE bloat SET filler = 'y'`;
    const [s2] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s2!.pages, 9);

    await A`VACUUM bloat`;
    t.note("VACUUM cleaned 1000 dead tuples — and the file is still 9 pages. The space is free *inside* the file.");
    const [s3] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s3!.pages, 9);

    await A`VACUUM FULL bloat`;
    t.note("VACUUM FULL rewrites the table from scratch — back to 5 pages. The price: it holds ACCESS EXCLUSIVE for the whole rewrite.");
    const [s4] = await A`SELECT (pg_relation_size('bloat') / 8192)::int AS pages`;
    eq(s4!.pages, 5);
    // #endregion
  },
});
