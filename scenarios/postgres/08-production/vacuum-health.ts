import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Vacuum health at a glance",
  claim:
    "pg_stat_user_tables shows dead tuples accumulating and when vacuum last ran, and age(datfrozenxid) vs autovacuum_freeze_max_age is the wraparound alert.",
  setup: `
    CREATE TABLE inventory (id int PRIMARY KEY, qty int NOT NULL);
  `,
  sessions: ["A", "M"],

  async run({ A, M }, t) {
    // #region demo
    await A`INSERT INTO inventory SELECT g, 10 FROM generate_series(1, 5) g`;
    await A`UPDATE inventory SET qty = qty + 1 WHERE id <= 3`;
    await A`SELECT pg_stat_force_next_flush()`; // stats reach the views lazily; force it for the demo

    t.note("Chapter 4 proved updates leave dead tuples behind; pg_stat_user_tables is where you SEE them:");
    const before = await M`
      SELECT relname, n_live_tup::int, n_dead_tup::int, last_vacuum IS NULL AS never_vacuumed
      FROM pg_stat_user_tables WHERE relname = 'inventory'`;
    eq(before, [{ relname: "inventory", n_live_tup: 5, n_dead_tup: 3, never_vacuumed: true }]);

    t.note("VACUUM cleans up — and the same view proves it happened:");
    await A`VACUUM inventory`;
    const after = await M`
      SELECT relname, n_live_tup::int, n_dead_tup::int, last_vacuum IS NOT NULL AS vacuumed
      FROM pg_stat_user_tables WHERE relname = 'inventory'`;
    eq(after, [{ relname: "inventory", n_live_tup: 5, n_dead_tup: 0, vacuumed: true }]);

    t.note("The one number that must never reach its limit: the database's xid age vs the emergency threshold.");
    const wrap = await M`
      SELECT age(datfrozenxid) < current_setting('autovacuum_freeze_max_age')::int AS wraparound_ok
      FROM pg_database WHERE datname = current_database()`;
    eq(wrap, [{ wraparound_ok: true }]);
    // #endregion demo
  },
});
