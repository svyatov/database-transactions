from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("A transfers 150 from alice to bob. Crediting bob works fine…")
    A("BEGIN")
    A("UPDATE accounts SET balance = balance + 150 WHERE owner = 'bob'")

    [bob] = B("SELECT balance FROM accounts WHERE owner = 'bob'")
    eq(bob["balance"], 50)  # B can't see A's uncommitted credit

    t.note("…but debiting alice violates the CHECK constraint — she only has 100.")
    err = A.fails("UPDATE accounts SET balance = balance - 150 WHERE owner = 'alice'")
    eq(err.code, "3819")  # ER_CHECK_CONSTRAINT_VIOLATED

    t.note("Roll the transaction back. Bob's credit — which had succeeded — evaporates with it.")
    A("ROLLBACK")

    rows = B("SELECT owner, balance FROM accounts ORDER BY id")
    eq(
        rows,
        [
            {"owner": "alice", "balance": 100},
            {"owner": "bob", "balance": 50},
        ],
    )
    # endregion demo


scenario = Scenario(
    title="Atomicity: all or nothing",
    claim="A transaction that fails halfway leaves zero partial writes — even statements that already succeeded inside it are undone.",
    setup="""
        CREATE TABLE accounts (
          id      int PRIMARY KEY,
          owner   varchar(20) NOT NULL,
          balance int NOT NULL CHECK (balance >= 0)
        );
        INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 50);
    """,
    sessions=("A", "B"),
    run=run,
)
