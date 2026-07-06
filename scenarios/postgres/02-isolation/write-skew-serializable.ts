import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "SERIALIZABLE catches write skew",
  claim:
    "The exact interleaving that breaks the invariant under REPEATABLE READ fails with SQLSTATE 40001 under SERIALIZABLE — one transaction commits, the other must retry.",
  setup: `
    CREATE TABLE doctors (name text PRIMARY KEY, on_call boolean NOT NULL);
    INSERT INTO doctors VALUES ('alice', true), ('bob', true);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Same story, same statements, same order — only the isolation level differs.");
    await A`BEGIN ISOLATION LEVEL SERIALIZABLE`;
    await B`BEGIN ISOLATION LEVEL SERIALIZABLE`;

    const [a] = await A`SELECT count(*)::int AS on_call FROM doctors WHERE on_call`;
    eq(a!.on_call, 2);

    const [b] = await B`SELECT count(*)::int AS on_call FROM doctors WHERE on_call`;
    eq(b!.on_call, 2);

    await A`UPDATE doctors SET on_call = false WHERE name = 'alice'`;
    await B`UPDATE doctors SET on_call = false WHERE name = 'bob'`;

    t.note("The first committer wins. The second cannot be serialized against it and is aborted.");
    await A`COMMIT`;

    const err = await B.fails`COMMIT`;
    eq(err.code, "40001"); // serialization_failure

    const [final] = await A`SELECT count(*)::int AS on_call FROM doctors WHERE on_call`;
    eq(final!.on_call, 1); // the invariant survived

    t.note("B's job is to retry. On retry it would see only one doctor on call — and refuse the night off.");
    // #endregion
  },
});
