import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "The check-then-insert race",
  claim:
    "\"SELECT first, INSERT if absent\" cannot enforce uniqueness: two concurrent requests both see 0 rows, both insert, and the duplicate lands without any error.",
  setup: `
    -- The app promised emails are unique — but only in code. No UNIQUE constraint.
    CREATE TABLE signups (id serial PRIMARY KEY, email text NOT NULL);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("The same person double-clicks 'Sign up'. Two app servers each run: check, then insert.");
    await A`BEGIN`;
    const [checkA] = await A`SELECT count(*)::int AS existing FROM signups WHERE email = 'bob@example.com'`;
    eq(checkA!.existing, 0);

    await B`BEGIN`;
    const [checkB] = await B`SELECT count(*)::int AS existing FROM signups WHERE email = 'bob@example.com'`;
    eq(checkB!.existing, 0); // B's check also passes — A hasn't committed anything

    t.note("Both checks passed, so both insert. Nothing blocks, nothing errors.");
    await A`INSERT INTO signups (email) VALUES ('bob@example.com')`;
    await A`COMMIT`;
    await B`INSERT INTO signups (email) VALUES ('bob@example.com')`;
    await B`COMMIT`;

    const [final] = await A`SELECT count(*)::int AS bobs FROM signups WHERE email = 'bob@example.com'`;
    eq(final!.bobs, 2); // the "impossible" duplicate
    // #endregion
  },
});
