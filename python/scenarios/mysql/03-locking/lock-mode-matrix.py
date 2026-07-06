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

    t.note("…but a FOR SHARE still blocks a plain UPDATE (which needs an X lock).")
    update = B.blocked("UPDATE accounts SET balance = 200 WHERE id = 1")
    A("COMMIT")
    update.success()

    t.note("And an X lock blocks even the friendliest reader: FOR SHARE has to wait for a running UPDATE.")
    A("BEGIN")
    A("UPDATE accounts SET balance = 300 WHERE id = 1")
    share = B.blocked("SELECT id FROM accounts WHERE id = 1 FOR SHARE")
    A("COMMIT")
    share.success()

    t.note("PostgreSQL's FOR KEY SHARE would coexist with that UPDATE — InnoDB has no lock that weak.")
    # endregion demo


scenario = Scenario(
    title="Two row-lock strengths: shared and exclusive",
    claim="InnoDB row locks come in exactly two strengths — S locks coexist with each other but block writers, X locks block everything. There is no PostgreSQL-style four-mode ladder.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
