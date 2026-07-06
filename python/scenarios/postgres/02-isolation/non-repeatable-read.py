from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN ISOLATION LEVEL READ COMMITTED")
    [first] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(first["balance"], 100)

    t.note("While A's transaction is still open, B updates the row and commits.")
    B("UPDATE accounts SET balance = 200 WHERE id = 1")

    [second] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(second["balance"], 200)  # same query, same transaction — different answer
    A("COMMIT")
    # endregion demo

    # region blocking
    t.note("Readers never block — but writers do. The same interleaving with UPDATEs makes B wait for A's row lock.")
    A("BEGIN")
    A("UPDATE accounts SET balance = 300 WHERE id = 1")

    pending = B.blocked("UPDATE accounts SET balance = 400 WHERE id = 1")

    A("COMMIT")  # releases the row lock
    pending.success()  # only now does B's UPDATE finish

    [final] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 400)  # B's write landed on top of A's committed 300
    # endregion blocking


scenario = Scenario(
    title="Non-repeatable read under READ COMMITTED",
    claim="At READ COMMITTED, a transaction can read two different values for the same row — other transactions' commits become visible between its statements.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
