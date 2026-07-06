import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "SERIALIZABLE catches write skew — with locks",
  claim:
    "Under MySQL's SERIALIZABLE, plain SELECTs take shared locks, so the write-skew interleaving deadlocks: one transaction is rolled back with errno 1213, and the invariant survives.",
  setup: `
    CREATE TABLE doctors (name varchar(20) PRIMARY KEY, on_call boolean NOT NULL);
    INSERT INTO doctors VALUES ('alice', true), ('bob', true);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Same story, same statements, same order — only the isolation level differs.");
    await A`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
    await B`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
    await A`BEGIN`;
    await B`BEGIN`;

    const [a] = await A`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(a!.on_call, 2);

    const [b] = await B`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(b!.on_call, 2);

    t.note("Those SELECTs took shared locks on the rows they read. A's write now waits for B…");
    const pending = await A.blocked`UPDATE doctors SET on_call = false WHERE name = 'alice'`;

    t.note("…and B's write closes the cycle. InnoDB detects the deadlock and rolls B back entirely.");
    const err = await B.fails`UPDATE doctors SET on_call = false WHERE name = 'bob'`;
    eq(err.code, "1213"); // ER_LOCK_DEADLOCK

    await pending.success(); // B's rollback freed the locks; A's update proceeds
    await A`COMMIT`;

    const [final] = await A`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(final!.on_call, 1); // the invariant survived

    t.note(
      "PostgreSQL detects the same skew without blocking (SSI, at COMMIT). MySQL prevents it the classic way: locks and a deadlock victim.",
    );
    // #endregion
  },
});
