from harness import Scenario


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Two FOR SHARE locks on the same row coexist happily…")
    A("BEGIN")
    A("SELECT id FROM accounts WHERE id = 1 FOR SHARE")
    B("BEGIN")
    B("SELECT id FROM accounts WHERE id = 1 FOR SHARE")
    B("COMMIT")

    t.note("…but FOR SHARE still blocks a plain UPDATE (which takes FOR NO KEY UPDATE).")
    update = B.blocked("UPDATE accounts SET balance = 200 WHERE id = 1")
    A("COMMIT")
    update.success()

    t.note("The weakest lock, FOR KEY SHARE, even coexists with a running UPDATE…")
    A("BEGIN")
    A("UPDATE accounts SET balance = 300 WHERE id = 1")
    B("SELECT id FROM accounts WHERE id = 1 FOR KEY SHARE")

    t.note("…while the strongest, FOR UPDATE, has to wait for it.")
    for_update = B.blocked("SELECT id FROM accounts WHERE id = 1 FOR UPDATE")
    A("COMMIT")
    for_update.success()
    # endregion demo


scenario = Scenario(
    title="The four row-lock modes, from friendly to exclusive",
    claim="FOR KEY SHARE < FOR SHARE < FOR NO KEY UPDATE < FOR UPDATE: two share-mode locks coexist, but a share lock still stops writers, and FOR UPDATE stops everything.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
