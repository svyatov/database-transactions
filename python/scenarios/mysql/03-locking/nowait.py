from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("SELECT id FROM accounts WHERE id = 1 FOR UPDATE")

    err = B.fails("SELECT id FROM accounts WHERE id = 1 FOR UPDATE NOWAIT")
    eq(err.code, "3572")  # ER_LOCK_NOWAIT — instantly, no waiting

    t.note("Once A is done, the same statement succeeds.")
    A("COMMIT")
    [row] = B("SELECT id FROM accounts WHERE id = 1 FOR UPDATE NOWAIT")
    eq(row["id"], 1)
    # endregion demo


scenario = Scenario(
    title="NOWAIT: fail fast instead of queueing",
    claim="SELECT ... FOR UPDATE NOWAIT refuses to wait: if the row is locked it fails immediately with errno 3572 instead of joining the lock queue.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
