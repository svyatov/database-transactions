from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Two app servers process a +10 deposit each: read the balance, add 10 in code, write it back.")
    A("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
    A("BEGIN")
    [read_a] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(read_a["balance"], 100)

    B("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
    B("BEGIN")
    [read_b] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(read_b["balance"], 100)  # B reads the same 100 — A hasn't committed

    A(f"UPDATE accounts SET balance = {read_a['balance'] + 10} WHERE id = 1")
    A("COMMIT")

    t.note("B computed 100 + 10 from its stale read. Nothing stops the write — A's transaction is long gone.")
    B(f"UPDATE accounts SET balance = {read_b['balance'] + 10} WHERE id = 1")
    B("COMMIT")

    [final] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 110)  # two +10 deposits, but only one survived

    t.note("A's deposit vanished without any error. Fixes: atomic UPDATE or SELECT FOR UPDATE — see the lesson.")
    # endregion demo


scenario = Scenario(
    title="Lost update at READ COMMITTED",
    claim="Two read-modify-write transactions at READ COMMITTED can silently overwrite each other: two deposits of 10 grow the balance by only 10.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
