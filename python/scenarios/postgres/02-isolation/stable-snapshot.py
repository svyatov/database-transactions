from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN ISOLATION LEVEL REPEATABLE READ")

    t.note("The snapshot is taken by the FIRST query, not by BEGIN.")
    first = A("SELECT id, balance FROM accounts ORDER BY id")
    eq(len(first), 2)

    t.note("B changes an existing row AND inserts a new one — both committed instantly.")
    B("UPDATE accounts SET balance = 999 WHERE id = 1")
    B("INSERT INTO accounts VALUES (3, 'carol', 300)")

    again = A("SELECT id, balance FROM accounts ORDER BY id")
    eq(
        again,
        [
            {"id": 1, "balance": 100},  # not 999 — no non-repeatable read
            {"id": 2, "balance": 50},  # and no carol — no phantom
        ],
    )

    A("COMMIT")

    t.note("Only a NEW transaction gets a new snapshot.")
    after = A("SELECT id, balance FROM accounts ORDER BY id")
    eq(len(after), 3)
    eq(after[0]["balance"], 999)
    # endregion demo


scenario = Scenario(
    title="REPEATABLE READ: one snapshot for the whole transaction",
    claim="At REPEATABLE READ, PostgreSQL uses a single snapshot for the entire transaction — no non-repeatable reads AND no phantoms (stronger than the SQL standard requires).",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 50);
    """,
    sessions=("A", "B"),
    run=run,
)
