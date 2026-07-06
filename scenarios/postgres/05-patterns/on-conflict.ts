import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "UNIQUE + ON CONFLICT: closing the race at the source",
  claim:
    "A UNIQUE constraint makes the concurrent duplicate wait for the first insert's fate and then fail with 23505 — and ON CONFLICT turns that error into a clean no-op or upsert.",
  setup: `
    CREATE TABLE signups (id serial PRIMARY KEY, email text UNIQUE NOT NULL);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Same double-click, but now the table has UNIQUE (email).");
    await A`BEGIN`;
    await A`INSERT INTO signups (email) VALUES ('bob@example.com')`;

    t.note("B's insert can't decide yet — the winner hasn't committed. It waits on A's transaction.");
    const pending = await B.blocked`INSERT INTO signups (email) VALUES ('bob@example.com')`;
    await A`COMMIT`;
    const err = await pending.failure();
    eq(err.code, "23505"); // unique_violation — the race is now loud instead of silent

    t.note("ON CONFLICT DO NOTHING absorbs the duplicate instead of erroring:");
    const absorbed = await B`
      INSERT INTO signups (email) VALUES ('bob@example.com')
      ON CONFLICT (email) DO NOTHING`;
    eq(absorbed.count, 0); // INSERT 0 0

    t.note("And DO UPDATE makes it an upsert — here just to read back the existing row's id:");
    const [row] = await B`
      INSERT INTO signups (email) VALUES ('bob@example.com')
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email`;
    eq(row!, { id: 1, email: "bob@example.com" });
    // #endregion demo
  },
});
