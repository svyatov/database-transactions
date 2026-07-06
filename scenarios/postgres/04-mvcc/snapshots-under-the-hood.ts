import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Snapshots under the hood: xmin, xmax, xip",
  claim:
    "A snapshot is three numbers — xmin, xmax, and the in-progress list — and visibility is pure arithmetic on them: committed before xmax and not in xip = visible. Commit order doesn't matter; the snapshot already decided.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 100);
  `,
  sessions: ["A", "B", "C"],

  async run({ A, B, C }, t) {
    // #region demo
    t.note("Transaction ids are handed out lazily — a transaction that only reads never gets one.");
    await A`BEGIN`;
    await A`SELECT balance FROM accounts WHERE id = 1`;
    const [before] = await A`SELECT pg_current_xact_id_if_assigned() AS xid`;
    eq(before!.xid, null);

    await A`UPDATE accounts SET balance = 150 WHERE id = 1`;
    const [after] = await A`SELECT pg_current_xact_id_if_assigned() AS xid`;
    const aXid = after!.xid as string; // A's xid — A stays open
    eq(aXid !== null, true);

    t.note("B grabs the next xid and commits immediately. A is still in progress.");
    const [bRow] = await B`UPDATE accounts SET balance = 200 WHERE id = 2 RETURNING xmin, balance`;
    const bXid = Number(bRow!.xmin);

    t.note("C opens a transaction and inspects its own snapshot: the three numbers that decide all visibility.");
    await C`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [snap] = await C`
      SELECT pg_snapshot_xmin(pg_current_snapshot()) AS xmin,
             pg_snapshot_xmax(pg_current_snapshot()) AS xmax`;
    eq(Number(snap!.xmin), Number(aXid), "xmin = oldest still-running xid: that's A");
    eq(Number(snap!.xmax), bXid + 1, "xmax = one past the highest COMPLETED xid: that's B + 1");

    t.note("xip = the xids that were in progress at snapshot time. A is on the list — so A is invisible even after it commits.");
    const xip = await C`SELECT pg_snapshot_xip(pg_current_snapshot()) AS xid`;
    eq(xip, [{ xid: aXid }]);

    t.note("The arithmetic in action: B (committed, below xmax) is visible; A (in xip) is not.");
    const seen1 = await C`SELECT id, owner, balance FROM accounts ORDER BY id`;
    eq(seen1, [
      { id: 1, owner: "alice", balance: 100 },
      { id: 2, owner: "bob", balance: 200 },
    ]);

    await A`COMMIT`;
    t.note("A has now committed — but C's snapshot already decided: still invisible.");
    const seen2 = await C`SELECT id, owner, balance FROM accounts ORDER BY id`;
    eq(seen2, seen1);

    await C`COMMIT`;
    t.note("Only a NEW snapshot changes the verdict.");
    const seen3 = await C`SELECT id, owner, balance FROM accounts ORDER BY id`;
    eq(seen3, [
      { id: 1, owner: "alice", balance: 150 },
      { id: 2, owner: "bob", balance: 200 },
    ]);
    // #endregion
  },
});
