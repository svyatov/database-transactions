import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "A saga and its compensating transaction",
  claim:
    "A saga replaces one distributed transaction with a chain of local ones: every step commits immediately and is visible to everyone, and a failed step is undone by a new compensating transaction — not by ROLLBACK.",
  setup: `
    CREATE TABLE flights (id int PRIMARY KEY, seats int NOT NULL CHECK (seats >= 0));
    CREATE TABLE hotels  (id int PRIMARY KEY, rooms int NOT NULL CHECK (rooms >= 0));
    INSERT INTO flights VALUES (1, 5);
    INSERT INTO hotels  VALUES (1, 0);  -- fully booked: step 2 will fail
  `,
  sessions: ["Saga", "Reader"],

  async run({ Saga, Reader }, t) {
    // #region demo
    t.note("Step 1 — book the flight. A local transaction, committed immediately.");
    await Saga`BEGIN`;
    const [flight] = await Saga`UPDATE flights SET seats = seats - 1 WHERE id = 1 RETURNING seats`;
    eq(flight!.seats, 4);
    await Saga`COMMIT`;

    t.note("A saga has no isolation: between steps, the whole world sees the half-done trip.");
    const [mid] = await Reader`SELECT seats FROM flights WHERE id = 1`;
    eq(mid!.seats, 4);

    t.note("Step 2 — book the hotel. No rooms left: the step fails as a business outcome, not an error.");
    await Saga`BEGIN`;
    const rooms = await Saga`UPDATE hotels SET rooms = rooms - 1 WHERE id = 1 AND rooms > 0`;
    eq(rooms.count, 0); // UPDATE 0 — nothing to book
    await Saga`ROLLBACK`;

    t.note("Step 1 already committed — there is nothing a ROLLBACK could undo. The saga runs a COMPENSATING transaction: a new forward transaction that reverses the booking.");
    await Saga`BEGIN`;
    const [comp] = await Saga`UPDATE flights SET seats = seats + 1 WHERE id = 1 RETURNING seats`;
    eq(comp!.seats, 5);
    await Saga`COMMIT`;
    // #endregion
  },
});
