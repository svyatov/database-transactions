from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = 999 WHERE id = 1")

    t.note("B explicitly requests READ UNCOMMITTED — the one level that would permit dirty reads.")
    B("BEGIN ISOLATION LEVEL READ UNCOMMITTED")

    [level] = B("SELECT current_setting('transaction_isolation') AS isolation")
    eq(level["isolation"], "read uncommitted")  # the setting is accepted…

    [row] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(row["balance"], 100)  # …but A's uncommitted 999 stays invisible

    B("COMMIT")
    A("ROLLBACK")
    # endregion demo


scenario = Scenario(
    title="PostgreSQL has no dirty reads — not even at READ UNCOMMITTED",
    claim="PostgreSQL accepts READ UNCOMMITTED syntax but behaves as READ COMMITTED: uncommitted changes from other transactions are never visible.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
