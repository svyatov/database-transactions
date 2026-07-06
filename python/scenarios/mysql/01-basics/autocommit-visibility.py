from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("No BEGIN — the UPDATE is its own transaction, committed the instant it finishes.")
    A("UPDATE accounts SET balance = 150 WHERE id = 1")

    [seen] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(seen["balance"], 150)  # B sees it immediately

    t.note("Inside an explicit transaction, A's change is invisible to B…")
    A("BEGIN")
    A("UPDATE accounts SET balance = 999 WHERE id = 1")

    [hidden] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(hidden["balance"], 150)  # still the old value

    t.note("…until A commits.")
    A("COMMIT")

    [visible] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(visible["balance"], 999)
    # endregion demo


scenario = Scenario(
    title="Autocommit and visibility",
    claim="Without BEGIN, every statement commits instantly and is immediately visible to everyone; inside BEGIN, changes stay private until COMMIT.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
