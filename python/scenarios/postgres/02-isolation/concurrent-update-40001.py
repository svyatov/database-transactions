from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region committed
    A("BEGIN ISOLATION LEVEL REPEATABLE READ")
    [snap] = A("SELECT balance FROM accounts WHERE id = 1")  # snapshot taken
    eq(snap["balance"], 100)

    t.note("B commits a change. A can keep READING its stale snapshot — but writing that row is refused.")
    B("UPDATE accounts SET balance = 150 WHERE id = 1")

    [stale] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(stale["balance"], 100)

    err = A.fails("UPDATE accounts SET balance = 200 WHERE id = 1")
    eq(err.code, "40001")  # serialization_failure — retry the whole transaction
    A("ROLLBACK")
    # endregion committed

    # region uncommitted
    t.note("If the competing write is NOT yet committed, the outcome is decided later: A first waits on the row lock…")
    A("BEGIN ISOLATION LEVEL REPEATABLE READ")
    A("SELECT balance FROM accounts WHERE id = 1")  # snapshot taken

    B("BEGIN")
    B("UPDATE accounts SET balance = 300 WHERE id = 1")

    pending = A.blocked("UPDATE accounts SET balance = 999 WHERE id = 1")

    t.note("…and fails with 40001 the moment B commits. (Had B rolled back, A would have proceeded.)")
    B("COMMIT")

    err2 = pending.failure()
    eq(err2.code, "40001")
    A("ROLLBACK")
    # endregion uncommitted


scenario = Scenario(
    title="REPEATABLE READ refuses to overwrite concurrent changes",
    claim="A REPEATABLE READ transaction that tries to UPDATE a row modified since its snapshot fails with SQLSTATE 40001 — immediately if the change is committed, or after waiting if it isn't.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
