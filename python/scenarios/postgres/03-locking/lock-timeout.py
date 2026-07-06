from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = 200 WHERE id = 1")

    B("SET lock_timeout = '100ms'")
    t.note("B queues for the row lock like anyone else — but gives up after 100ms.")
    err = B.fails("UPDATE accounts SET balance = 300 WHERE id = 1")
    eq(err.code, "55P03")  # lock_not_available, raised after the timeout

    t.note("The failure canceled only B's statement — a retry after A commits works.")
    A("COMMIT")
    B("UPDATE accounts SET balance = 300 WHERE id = 1")
    [row] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(row["balance"], 300)
    # endregion demo


scenario = Scenario(
    title="lock_timeout: wait, but not forever",
    claim="With lock_timeout set, a statement waits for a lock only that long, then fails with SQLSTATE 55P03 — the same code NOWAIT raises immediately.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
