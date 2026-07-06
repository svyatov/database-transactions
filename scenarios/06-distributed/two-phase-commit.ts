import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "PREPARE TRANSACTION survives its session",
  claim:
    "PREPARE TRANSACTION detaches a transaction from its session: it survives the session's death, keeps holding its locks, and any later session can finish it by name with COMMIT PREPARED.",
  setup: `
    CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
    INSERT INTO accounts VALUES (1, 100);
  `,
  sessions: ["A", "B", "M"],

  async run({ A, B, M }, t) {
    // #region demo
    t.note("A is one participant in a distributed transfer. It does its work, then PREPARES — phase one.");
    await A`BEGIN`;
    await A`UPDATE accounts SET balance = 200 WHERE id = 1`;
    await A`PREPARE TRANSACTION 'transfer-42'`;

    t.note("PREPARE detached the transaction from the session: A itself no longer sees its own change.");
    const [detached] = await A`SELECT balance FROM accounts WHERE id = 1`;
    eq(detached!.balance, 100);

    const prepared = await M`SELECT gid, owner, database FROM pg_prepared_xacts`;
    eq(prepared, [{ gid: "transfer-42", owner: "postgres", database: "postgres" }]);

    t.note("The prepared transaction still holds its row locks — with no session attached.");
    const locked = await B.fails`SELECT balance FROM accounts WHERE id = 1 FOR UPDATE NOWAIT`;
    eq(locked.code, "55P03"); // lock_not_available

    t.note("Now the coordinator crashes: A's backend is killed outright.");
    const [kill] = await M`
      SELECT pg_terminate_backend(pid) AS terminated
      FROM pg_stat_activity WHERE application_name = 'A'`;
    eq(kill!.terminated, true);
    // #endregion

    await Bun.sleep(300); // let the client side notice the dead socket

    // #region survives
    const dead = await A.fails`SELECT 1`;
    eq(dead.code, "ERR_POSTGRES_CONNECTION_CLOSED");

    t.note("The session is gone. The prepared transaction is not — it survives anything short of COMMIT/ROLLBACK PREPARED, including a full server restart. And it still holds its locks:");
    const survivors = await M`SELECT gid FROM pg_prepared_xacts`;
    eq(survivors, [{ gid: "transfer-42" }]);
    const stillLocked = await B.fails`SELECT balance FROM accounts WHERE id = 1 FOR UPDATE NOWAIT`;
    eq(stillLocked.code, "55P03");

    t.note("Phase two — any session can finish the job by name. B commits the orphan.");
    await B`COMMIT PREPARED 'transfer-42'`;
    const [final] = await B`SELECT balance FROM accounts WHERE id = 1`;
    eq(final!.balance, 200);
    // #endregion
  },
});
