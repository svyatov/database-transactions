from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Both transfers grab *all* their row locks up front, ordered by id.")
    A("BEGIN")
    A("SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE")

    B("BEGIN")
    queued = B.blocked("SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE")

    t.note("No cycle is possible: B parks at the first row and holds nothing A needs.")
    A("UPDATE accounts SET balance = balance - 10 WHERE id = 1")
    A("UPDATE accounts SET balance = balance + 10 WHERE id = 2")
    A("COMMIT")

    queued.success()
    B("UPDATE accounts SET balance = balance - 25 WHERE id = 2")
    B("UPDATE accounts SET balance = balance + 25 WHERE id = 1")
    B("COMMIT")

    rows = A("SELECT owner, balance FROM accounts ORDER BY id")
    eq(
        rows,
        [
            {"owner": "alice", "balance": 115},
            {"owner": "bob", "balance": 85},
        ],
    )  # both transfers landed — same workload, zero deadlocks
    # endregion demo


scenario = Scenario(
    title="Deadlock avoidance: lock rows in a consistent order",
    claim="The same two opposite-direction transfers cannot deadlock if both transactions lock the rows in the same (id) order first — the second simply waits its turn.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
