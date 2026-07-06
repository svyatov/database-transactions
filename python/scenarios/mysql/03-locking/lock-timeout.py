from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = 200 WHERE id = 1")

    B("SET SESSION innodb_lock_wait_timeout = 1")
    t.note("B queues for the row lock like anyone else — but gives up after a second.")
    err = B.fails("UPDATE accounts SET balance = 300 WHERE id = 1")
    eq(err.code, "1205")  # ER_LOCK_WAIT_TIMEOUT, raised after the timeout

    t.note("The failure canceled only B's statement — a retry after A commits works.")
    A("COMMIT")
    B("UPDATE accounts SET balance = 300 WHERE id = 1")
    [row] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(row["balance"], 300)
    # endregion demo


scenario = Scenario(
    title="innodb_lock_wait_timeout: wait, but not forever",
    claim="With innodb_lock_wait_timeout set, a statement waits for a row lock only that long, then fails with errno 1205 — only the statement is rolled back, the transaction survives.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
