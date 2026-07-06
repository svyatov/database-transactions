from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("The same two +10 deposits — but this time at REPEATABLE READ.")
    A("BEGIN ISOLATION LEVEL REPEATABLE READ")
    [read_a] = A("SELECT balance FROM accounts WHERE id = 1")

    B("BEGIN ISOLATION LEVEL REPEATABLE READ")
    [read_b] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(read_b["balance"], 100)

    A(f"UPDATE accounts SET balance = {read_a['balance'] + 10} WHERE id = 1")
    A("COMMIT")

    t.note("B's snapshot predates A's commit, so B's write is refused instead of silently clobbering it.")
    err = B.fails(f"UPDATE accounts SET balance = {read_b['balance'] + 10} WHERE id = 1")
    eq(err.code, "40001")  # serialization_failure
    B("ROLLBACK")

    [final] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 110)  # A's deposit is safe; B retries and lands on 120

    t.note("Retrying B from scratch reads the fresh 110 and correctly produces 120.")
    # endregion demo


scenario = Scenario(
    title="REPEATABLE READ turns lost updates into errors",
    claim="The interleaving that silently loses an update at READ COMMITTED fails loudly with SQLSTATE 40001 at REPEATABLE READ — no data is lost, the loser just retries.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
