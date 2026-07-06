from harness import Scenario, eq


def run(s, t):
    A, B, C = s["A"], s["B"], s["C"]
    # region demo
    A("BEGIN")
    A("SELECT balance FROM accounts WHERE id = 1")  # the same long transaction as before

    t.note("Same migration — but this time it gives up after 100ms instead of camping in the queue.")
    B("SET lock_timeout = '100ms'")
    err = B.fails("ALTER TABLE accounts ADD COLUMN note text")
    eq(err.code, "55P03")

    t.note("No waiting ALTER in the queue means no outage: C's read is instant.")
    [row] = C("SELECT balance FROM accounts WHERE id = 1")
    eq(row["balance"], 100)

    A("COMMIT")
    t.note("Retry the migration when it can actually get the lock — now it sails through.")
    B("ALTER TABLE accounts ADD COLUMN note text")
    # endregion demo


scenario = Scenario(
    title="The fix: run DDL with a lock_timeout",
    claim="With lock_timeout set, a migration that can't get its lock fails fast (55P03) instead of queueing — and other sessions' queries are never blocked behind it.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B", "C"),
    run=run,
)
