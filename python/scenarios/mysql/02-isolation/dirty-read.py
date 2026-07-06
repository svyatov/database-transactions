from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = 999 WHERE id = 1")

    t.note("B opts into READ UNCOMMITTED — and sees A's uncommitted 999.")
    B("SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
    B("BEGIN")

    [level] = B("SELECT @@transaction_isolation AS isolation")
    eq(level["isolation"], "READ-UNCOMMITTED")

    [dirty] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(dirty["balance"], 999)  # a dirty read — A never committed this

    t.note("A rolls back. The 999 B just read never existed.")
    A("ROLLBACK")

    [after] = B("SELECT balance FROM accounts WHERE id = 1")
    eq(after["balance"], 100)
    B("COMMIT")
    # endregion demo


scenario = Scenario(
    title="READ UNCOMMITTED really reads uncommitted data",
    claim="At READ UNCOMMITTED, MySQL serves other transactions' uncommitted changes — including values that are later rolled back and thus never existed.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
