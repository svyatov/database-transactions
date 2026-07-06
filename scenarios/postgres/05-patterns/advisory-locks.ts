import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Advisory locks: locking ideas, not rows",
  claim:
    "Advisory locks serialize application-defined work with no table involved: try-lock answers instantly, session-level locks survive COMMIT and need an explicit unlock, transaction-level locks vanish at COMMIT.",
  setup: `
    -- No tables. Advisory locks guard whatever the application says number 42 means.
  `,
  sessions: ["A", "B"],

  async run({ A, B }, t) {
    // #region demo
    t.note("Two deploy runners must not migrate the same database at once. They agree lock 42 means 'migration in progress'.");
    await A`SELECT pg_advisory_lock(42)`;

    const [probe] = await B`SELECT pg_try_advisory_lock(42) AS got_it`;
    eq(probe!.got_it, false); // an instant answer — no waiting

    t.note("try-lock says no without waiting. A runner can also queue up for the lock:");
    const pending = await B.blocked`SELECT pg_advisory_lock(42)`;
    await A`SELECT pg_advisory_unlock(42) AS released`;
    await pending.success();
    // #endregion demo

    // #region session-vs-xact
    t.note("Session-level locks ignore transaction boundaries entirely — COMMIT releases nothing.");
    await A`BEGIN`;
    await A`SELECT pg_advisory_lock(9)`;
    await A`COMMIT`;
    const [held] = await B`SELECT pg_try_advisory_lock(9) AS got_it`;
    eq(held!.got_it, false, "session-level advisory lock survived COMMIT");
    await A`SELECT pg_advisory_unlock(9) AS released`;

    t.note("pg_advisory_xact_lock, by contrast, releases itself at COMMIT — there is no unlock function for it.");
    await A`BEGIN`;
    await A`SELECT pg_advisory_xact_lock(7)`;
    const [during] = await B`SELECT pg_try_advisory_lock(7) AS got_it`;
    eq(during!.got_it, false);
    await A`COMMIT`;
    const [after] = await B`SELECT pg_try_advisory_lock(7) AS got_it`;
    eq(after!.got_it, true); // freed by A's COMMIT alone

    await B`SELECT pg_advisory_unlock(7)`;
    await B`SELECT pg_advisory_unlock(42)`;
    // #endregion session-vs-xact
  },
});
