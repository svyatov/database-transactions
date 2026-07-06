from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("The same two +10 deposits — this time at REPEATABLE READ, MySQL's default.")
    A("BEGIN")
    [read_a] = A("SELECT balance FROM accounts WHERE id = 1")

    B("BEGIN")
    [read_b] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(read_b["balance"], 100)

    A(f"UPDATE accounts SET balance = {read_a['balance'] + 10} WHERE id = 1")
    A("COMMIT")

    t.note("B's snapshot predates A's commit — but MySQL's UPDATE acts on the CURRENT row and raises nothing.")
    B(f"UPDATE accounts SET balance = {read_b['balance'] + 10} WHERE id = 1")
    B("COMMIT")

    [final] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 110)  # A's deposit is gone — silently, even at REPEATABLE READ

    t.note("PostgreSQL refuses B's write here (SQLSTATE 40001). MySQL does not — don't port that assumption.")
    # endregion demo


scenario = Scenario(
    title="REPEATABLE READ does NOT stop lost updates",
    claim="The interleaving that loses an update at READ COMMITTED loses it at REPEATABLE READ too — MySQL raises no error, unlike PostgreSQL's 40001. The fix must be a locking read or an atomic UPDATE.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
