import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Write skew: REPEATABLE READ is not enough",
  claim:
    "Two REPEATABLE READ transactions can each validate an invariant against their snapshots, write to different rows, and both commit — leaving the invariant broken. This is write skew.",
  setup: `
    CREATE TABLE doctors (name varchar(20) PRIMARY KEY, on_call boolean NOT NULL);
    INSERT INTO doctors VALUES ('alice', true), ('bob', true);
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Hospital rule: at least one doctor must stay on call. Alice and Bob both want the night off.");
    await A`BEGIN`;
    await B`BEGIN`;

    const [a] = await A`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(a!.on_call, 2); // "two of us — safe for me to leave"

    const [b] = await B`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(b!.on_call, 2); // "two of us — safe for me to leave"

    t.note("Each updates a DIFFERENT row, so there is no write-write conflict to detect.");
    await A`UPDATE doctors SET on_call = false WHERE name = 'alice'`;
    await B`UPDATE doctors SET on_call = false WHERE name = 'bob'`;

    await A`COMMIT`;
    await B`COMMIT`; // both succeed!

    const [final] = await A`SELECT count(*) AS on_call FROM doctors WHERE on_call`;
    eq(final!.on_call, 0); // nobody is on call — the invariant is broken

    t.note(
      "Each transaction was internally consistent; together they broke the rule. Only SERIALIZABLE catches this.",
    );
    // #endregion
  },
});
