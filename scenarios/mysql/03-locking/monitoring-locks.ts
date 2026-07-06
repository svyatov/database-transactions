import { scenario, eq } from "../../../harness/scenario";

export default scenario({
  title: "Reading performance_schema.data_locks: what one UPDATE really holds",
  claim:
    "data_locks shows every lock a transaction holds — a single-row UPDATE takes an intention lock on the table plus a record lock on the row — and a waiter shows up as WAITING, findable via sys.innodb_lock_waits.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 'alice', 100);
  `,
  sessions: ["A", "B", "M"],

  async run({ A, B, M }, t) {
    // #region demo
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 200 WHERE id = 1`;

    t.note("One innocent UPDATE = two locks: an intention-exclusive on the table, an exclusive on the row.");
    const held = await M`
      SELECT object_name, index_name, lock_type, lock_mode, lock_status, lock_data
      FROM performance_schema.data_locks
      ORDER BY lock_type DESC`;
    eq([...held], [
      { object_name: "accounts", index_name: null, lock_type: "TABLE", lock_mode: "IX", lock_status: "GRANTED", lock_data: null },
      { object_name: "accounts", index_name: "PRIMARY", lock_type: "RECORD", lock_mode: "X,REC_NOT_GAP", lock_status: "GRANTED", lock_data: "1" },
    ]);
    // #endregion

    // #region waiter
    const pending = await B.blocked`UPDATE accounts SET balance = 300 WHERE id = 1`;

    t.note("The waiter's tell: a record-lock request with lock_status = WAITING.");
    const waiting = await M`
      SELECT object_name, lock_mode, lock_status, lock_data
      FROM performance_schema.data_locks
      WHERE lock_status = 'WAITING'`;
    eq([...waiting], [
      { object_name: "accounts", lock_mode: "X,REC_NOT_GAP", lock_status: "WAITING", lock_data: "1" },
    ]);

    t.note("You rarely need to decode data_locks by hand — sys.innodb_lock_waits names the culprit.");
    const chain = await M`SELECT waiting_pid, blocking_pid FROM sys.innodb_lock_waits`;
    eq([...chain], [{ waiting_pid: t.pid("B"), blocking_pid: t.pid("A") }]);

    await A`COMMIT`;
    await pending.success();
    // #endregion
  },
});
